const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all data sources for a user
 */
const getDataSources = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const dataSources = await db('data_sources')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    res.json({
      success: true,
      data: {
        dataSources,
        total: dataSources.length,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching data sources:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch data sources'
    });
  }
};

/**
 * Get specific data source by ID
 */
const getDataSourceById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const dataSource = await db('data_sources')
      .where({ id, user_id: userId })
      .first();

    if (!dataSource) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    res.json({
      success: true,
      data: dataSource
    });

  } catch (error) {
    logger.error('Error fetching data source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch data source'
    });
  }
};

/**
 * Upload and process data file
 */
const uploadDataSource = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Parse file based on type
    let parsedData = [];
    let schema = {};
    let rowCount = 0;

    try {
      if (file.mimetype === 'text/csv') {
        parsedData = await parseCSV(file.path);
      } else if (file.mimetype === 'application/vnd.ms-excel' || 
                 file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        parsedData = await parseExcel(file.path);
      } else if (file.mimetype === 'application/json') {
        parsedData = await parseJSON(file.path);
      }

      rowCount = parsedData.length;
      schema = generateSchema(parsedData);

    } catch (parseError) {
      logger.error('Error parsing file:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Failed to parse file',
        error: parseError.message
      });
    }

    // Store data source in database
    const [dataSourceId] = await db('data_sources').insert({
      user_id: userId,
      name: file.originalname,
      type: file.mimetype,
      status: 'processed',
      file_path: file.path,
      file_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
      schema: schema,
      preview_data: parsedData.slice(0, 100), // Store first 100 rows as preview
      row_count: rowCount,
      processing_config: {
        uploaded_at: new Date().toISOString(),
        processed_at: new Date().toISOString()
      }
    }).returning('id');

    logger.info(`Data source uploaded: ${file.originalname} (${rowCount} rows)`);

    res.json({
      success: true,
      message: 'Data source uploaded and processed successfully',
      data: {
        id: dataSourceId,
        name: file.originalname,
        type: file.mimetype,
        rowCount,
        schema,
        preview: parsedData.slice(0, 10)
      }
    });

  } catch (error) {
    logger.error('Error uploading data source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload data source',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Process data source with AI
 */
const processDataSource = async (req, res) => {
  try {
    const { id } = req.params;
    const { processingType } = req.body;
    const userId = req.user.id;

    const dataSource = await db('data_sources')
      .where({ id, user_id: userId })
      .first();

    if (!dataSource) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    // Update status to processing
    await db('data_sources')
      .where({ id })
      .update({
        status: 'processing',
        processing_config: db.raw(`processing_config || '{"processing_type": "${processingType}", "started_at": "${new Date().toISOString()}"}'::jsonb`)
      });

    // Simulate processing (in real implementation, this would trigger AI processing)
    setTimeout(async () => {
      await db('data_sources')
        .where({ id })
        .update({
          status: 'completed',
          processing_config: db.raw(`processing_config || '{"completed_at": "${new Date().toISOString()}"}'::jsonb`)
        });
    }, 5000);

    res.json({
      success: true,
      message: 'Data processing started',
      data: {
        id,
        status: 'processing',
        processingType
      }
    });

  } catch (error) {
    logger.error('Error processing data source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process data source'
    });
  }
};

/**
 * Get data preview
 */
const getDataPreview = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    const dataSource = await db('data_sources')
      .where({ id, user_id: userId })
      .first();

    if (!dataSource) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    const previewData = dataSource.preview_data || [];
    const paginatedData = previewData.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );

    res.json({
      success: true,
      data: {
        preview: paginatedData,
        total: previewData.length,
        schema: dataSource.schema,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching data preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch data preview'
    });
  }
};

/**
 * Get data schema
 */
const getDataSchema = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const dataSource = await db('data_sources')
      .where({ id, user_id: userId })
      .first();

    if (!dataSource) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    res.json({
      success: true,
      data: {
        schema: dataSource.schema,
        rowCount: dataSource.row_count,
        columns: Object.keys(dataSource.schema || {}),
        dataTypes: dataSource.schema
      }
    });

  } catch (error) {
    logger.error('Error fetching data schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch data schema'
    });
  }
};

/**
 * Analyze data with AI
 */
const analyzeData = async (req, res) => {
  try {
    const { dataSourceId, analysisType, parameters } = req.body;
    const userId = req.user.id;

    const dataSource = await db('data_sources')
      .where({ id: dataSourceId, user_id: userId })
      .first();

    if (!dataSource) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    // Store analysis request
    const [analysisId] = await db('ai_insights').insert({
      user_id: userId,
      data_source_id: dataSourceId,
      type: 'data_analysis',
      title: `Data Analysis - ${analysisType}`,
      description: `AI analysis of ${dataSource.name}`,
      insight_data: {
        analysisType,
        parameters,
        dataSource: {
          id: dataSourceId,
          name: dataSource.name,
          rowCount: dataSource.row_count
        }
      },
      status: 'processing',
      generated_at: new Date()
    }).returning('id');

    res.json({
      success: true,
      message: 'Data analysis started',
      data: {
        analysisId,
        status: 'processing'
      }
    });

  } catch (error) {
    logger.error('Error analyzing data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze data'
    });
  }
};

/**
 * Get analysis result
 */
const getAnalysisResult = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const analysis = await db('ai_insights')
      .where({ id, user_id: userId, type: 'data_analysis' })
      .first();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found'
      });
    }

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('Error fetching analysis result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analysis result'
    });
  }
};

/**
 * Get analysis history
 */
const getAnalysisHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const analyses = await db('ai_insights')
      .where({ user_id: userId, type: 'data_analysis' })
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    res.json({
      success: true,
      data: {
        analyses,
        total: analyses.length,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching analysis history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analysis history'
    });
  }
};

/**
 * Export data
 */
const exportData = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;
    const userId = req.user.id;

    const dataSource = await db('data_sources')
      .where({ id, user_id: userId })
      .first();

    if (!dataSource) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    const data = dataSource.preview_data || [];

    if (format === 'csv') {
      const csvData = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${dataSource.name}.csv"`);
      res.send(csvData);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${dataSource.name}.json"`);
      res.json(data);
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported export format'
      });
    }

  } catch (error) {
    logger.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    });
  }
};

/**
 * Export data in specific format
 */
const exportDataFormat = async (req, res) => {
  try {
    const { id, format } = req.params;
    const userId = req.user.id;

    const dataSource = await db('data_sources')
      .where({ id, user_id: userId })
      .first();

    if (!dataSource) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    const data = dataSource.preview_data || [];

    switch (format) {
      case 'csv':
        const csvData = convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${dataSource.name}.csv"`);
        res.send(csvData);
        break;
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${dataSource.name}.json"`);
        res.json(data);
        break;
      case 'xlsx':
        const xlsxBuffer = convertToXLSX(data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${dataSource.name}.xlsx"`);
        res.send(xlsxBuffer);
        break;
      default:
        res.status(400).json({
          success: false,
          message: 'Unsupported export format'
        });
    }

  } catch (error) {
    logger.error('Error exporting data format:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data format'
    });
  }
};

/**
 * Delete data source
 */
const deleteDataSource = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const dataSource = await db('data_sources')
      .where({ id, user_id: userId })
      .first();

    if (!dataSource) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    // Delete file if it exists
    if (dataSource.file_path && fs.existsSync(dataSource.file_path)) {
      fs.unlinkSync(dataSource.file_path);
    }

    // Delete from database
    await db('data_sources')
      .where({ id, user_id: userId })
      .del();

    res.json({
      success: true,
      message: 'Data source deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting data source:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete data source'
    });
  }
};

// Helper functions

/**
 * Parse CSV file
 */
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

/**
 * Parse Excel file
 */
const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

/**
 * Parse JSON file
 */
const parseJSON = (filePath) => {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(fileContent);
};

/**
 * Generate schema from data
 */
const generateSchema = (data) => {
  if (!data || data.length === 0) return {};

  const schema = {};
  const sample = data[0];

  Object.keys(sample).forEach(key => {
    const value = sample[key];
    schema[key] = {
      type: typeof value,
      nullable: value === null || value === undefined,
      sample: value
    };
  });

  return schema;
};

/**
 * Convert data to CSV
 */
const convertToCSV = (data) => {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
};

/**
 * Convert data to XLSX
 */
const convertToXLSX = (data) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  getDataSources,
  getDataSourceById,
  uploadDataSource,
  processDataSource,
  getDataPreview,
  getDataSchema,
  analyzeData,
  getAnalysisResult,
  getAnalysisHistory,
  exportData,
  exportDataFormat,
  deleteDataSource
};
