exports.up = function(knex) {
  return knex.schema
    // Automations
    .createTable('automations', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('name').notNullable();
      table.text('description').nullable();
      table.jsonb('triggers').notNullable(); // Array of trigger conditions
      table.jsonb('actions').notNullable(); // Array of actions to execute
      table.jsonb('conditions').defaultTo('[]'); // Array of conditions
      table.jsonb('settings').defaultTo('{}'); // Automation settings
      table.string('status').defaultTo('draft'); // draft, active, paused, archived
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['status']);
      table.index(['created_at']);
    })
    
    // Automation Executions
    .createTable('automation_executions', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('automation_id').references('id').inTable('automations').onDelete('CASCADE');
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.jsonb('trigger_data').notNullable(); // Data that triggered the automation
      table.jsonb('execution_results').notNullable(); // Results of action executions
      table.string('status').defaultTo('pending'); // pending, completed, failed
      table.text('error_message').nullable();
      table.timestamp('executed_at').notNullable();
      table.timestamps(true, true);
      
      table.index(['automation_id']);
      table.index(['user_id']);
      table.index(['status']);
      table.index(['executed_at']);
    })
    
    // Automation Templates
    .createTable('automation_templates', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.text('description').nullable();
      table.string('category').notNullable(); // whatsapp, email, social, etc.
      table.jsonb('triggers').notNullable();
      table.jsonb('actions').notNullable();
      table.jsonb('conditions').defaultTo('[]');
      table.jsonb('settings').defaultTo('{}');
      table.boolean('is_public').defaultTo(false);
      table.integer('usage_count').defaultTo(0);
      table.timestamps(true, true);
      
      table.index(['category']);
      table.index(['is_public']);
      table.index(['usage_count']);
    })
    
    // Automation Analytics
    .createTable('automation_analytics', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('automation_id').references('id').inTable('automations').onDelete('CASCADE');
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.date('date').notNullable();
      table.integer('executions_count').defaultTo(0);
      table.integer('successful_executions').defaultTo(0);
      table.integer('failed_executions').defaultTo(0);
      table.float('average_execution_time').nullable();
      table.jsonb('performance_metrics').defaultTo('{}');
      table.timestamps(true, true);
      
      table.index(['automation_id']);
      table.index(['user_id']);
      table.index(['date']);
      table.unique(['automation_id', 'date']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('automation_analytics')
    .dropTable('automation_templates')
    .dropTable('automation_executions')
    .dropTable('automations');
};
