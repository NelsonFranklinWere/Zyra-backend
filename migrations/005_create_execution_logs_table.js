exports.up = function(knex) {
  return knex.schema.createTable('execution_logs', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('automation_id').references('id').inTable('automations').onDelete('CASCADE');
    table.string('status').notNullable(); // success, error, warning
    table.text('message').nullable();
    table.jsonb('input_data').nullable();
    table.jsonb('output_data').nullable();
    table.jsonb('error_details').nullable();
    table.integer('execution_time_ms').nullable();
    table.string('trigger_type').nullable(); // manual, scheduled, webhook, api
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
    
    table.index(['user_id']);
    table.index(['automation_id']);
    table.index(['status']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('execution_logs');
};

