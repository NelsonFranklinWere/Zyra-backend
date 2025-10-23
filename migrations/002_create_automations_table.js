exports.up = function(knex) {
  return knex.schema.createTable('automations', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description').nullable();
    table.string('status').defaultTo('draft').notNullable(); // draft, active, paused, error
    table.jsonb('workflow_config').notNullable(); // n8n workflow configuration
    table.jsonb('trigger_config').nullable(); // trigger settings
    table.jsonb('ai_config').nullable(); // AI processing configuration
    table.integer('execution_count').defaultTo(0);
    table.integer('success_count').defaultTo(0);
    table.integer('error_count').defaultTo(0);
    table.timestamp('last_executed').nullable();
    table.timestamp('next_execution').nullable();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
    
    table.index(['user_id']);
    table.index(['status']);
    table.index(['last_executed']);
    table.index(['next_execution']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('automations');
};

