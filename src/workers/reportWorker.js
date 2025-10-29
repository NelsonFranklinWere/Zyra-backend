const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');
const puppeteer = require('puppeteer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const prisma = new PrismaClient();

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

class ReportWorker {
  constructor() {
    this.worker = new Worker('report-queue', this.processReportJob.bind(this), {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      },
      concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 3
    });

    this.worker.on('completed', (job) => {
      logger.info('Report job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('Report job failed', { jobId: job.id, error: err.message });
    });
  }

  async processReportJob(job) {
    const { type, data } = job.data;
    
    try {
      switch (type) {
        case 'generate_report':
          return await this.generateReport(data);
        case 'schedule_report':
          return await this.scheduleReport(data);
        default:
          throw new Error(`Unknown report job type: ${type}`);
      }
    } catch (error) {
      logger.error('Report worker error:', error);
      throw error;
    }
  }

  async generateReport(data) {
    const { reportId, tenantId } = data;
    
    try {
      // Get report configuration
      const report = await prisma.report.findFirst({
        where: { id: reportId, tenantId }
      });

      if (!report) {
        throw new Error('Report not found');
      }

      // Create report run record
      const reportRun = await prisma.reportRun.create({
        data: {
          reportId,
          tenantId,
          status: 'RUNNING'
        }
      });

      // Execute query based on report type
      let reportData;
      if (report.query.type === 'sql') {
        reportData = await this.executeSQLQuery(report.query.sql);
      } else if (report.query.type === 'api') {
        reportData = await this.executeAPIQuery(report.query.endpoint);
      } else {
        throw new Error('Unsupported query type');
      }

      // Generate report file
      const reportFile = await this.generateReportFile(report, reportData);

      // Upload to cloud storage
      const resultUrl = await this.uploadReportFile(reportFile, reportId);

      // Update report run with results
      await prisma.reportRun.update({
        where: { id: reportRun.id },
        data: {
          status: 'SUCCESS',
          resultUrl,
          finishedAt: new Date()
        }
      });

      // Update report last run time
      await prisma.report.update({
        where: { id: reportId },
        data: { lastRunAt: new Date() }
      });

      // Send notifications to recipients
      await this.notifyRecipients(report, resultUrl);

      logger.info('Report generated successfully', { reportId, resultUrl });
      return { success: true, resultUrl };
    } catch (error) {
      logger.error('Error generating report:', error);
      
      // Update report run with error
      await prisma.reportRun.updateMany({
        where: { reportId: data.reportId, tenantId: data.tenantId },
        data: {
          status: 'FAILED',
          error: error.message,
          finishedAt: new Date()
        }
      });
      
      throw error;
    }
  }

  async executeSQLQuery(sql) {
    // Execute SQL query against the database
    // This is a simplified implementation
    const result = await prisma.$queryRawUnsafe(sql);
    return result;
  }

  async executeAPIQuery(endpoint) {
    // Execute API query
    const response = await fetch(endpoint);
    return await response.json();
  }

  async generateReportFile(report, data) {
    const { format = 'pdf', template } = report.settings;
    
    if (format === 'pdf') {
      return await this.generatePDFReport(report, data, template);
    } else if (format === 'csv') {
      return await this.generateCSVReport(report, data);
    } else {
      throw new Error('Unsupported report format');
    }
  }

  async generatePDFReport(report, data, template) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Generate HTML content
      const html = this.generateHTMLContent(report, data, template);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      });

      return {
        buffer: pdf,
        filename: `${report.name}_${Date.now()}.pdf`,
        contentType: 'application/pdf'
      };
    } finally {
      await browser.close();
    }
  }

  async generateCSVReport(report, data) {
    const csv = this.convertToCSV(data);
    return {
      buffer: Buffer.from(csv, 'utf8'),
      filename: `${report.name}_${Date.now()}.csv`,
      contentType: 'text/csv'
    };
  }

  generateHTMLContent(report, data, template) {
    // Generate HTML content for the report
    // This would use a template engine like Handlebars
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .content { margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${report.name}</h1>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        <div class="content">
          ${this.formatReportData(data)}
        </div>
      </body>
      </html>
    `;
  }

  formatReportData(data) {
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      return `
        <table>
          <thead>
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                ${headers.map(header => `<td>${row[header]}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }

  convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  async uploadReportFile(reportFile, reportId) {
    const key = `reports/${reportId}/${reportFile.filename}`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: reportFile.buffer,
      ContentType: reportFile.contentType
    });

    await s3Client.send(command);
    
    // Return presigned URL or public URL
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  async notifyRecipients(report, resultUrl) {
    if (!report.recipients || report.recipients.length === 0) {
      return;
    }

    for (const recipient of report.recipients) {
      await this.sendReportNotification(recipient, report, resultUrl);
    }
  }

  async sendReportNotification(recipient, report, resultUrl) {
    // Send notification email with report link
    // Implementation depends on your email service
    logger.info('Report notification sent', { 
      recipient: recipient.email, 
      reportName: report.name 
    });
  }

  async scheduleReport(data) {
    // Handle scheduled report execution
    const { reportId, tenantId, schedule } = data;
    
    logger.info('Scheduled report triggered', { reportId, tenantId });
    
    // Queue the report generation
    await this.generateReport({ reportId, tenantId });
  }
}

module.exports = ReportWorker;
