exports.up = function(knex) {
  return knex.schema.createTable('data_sources', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('type').notNullable(); // csv, excel, json, api, database
    table.string('status').defaultTo('processing').notNullable(); // processing, ready, error
    table.string('file_path').nullable(); // for uploaded files
    table.string('file_name').nullable();
    table.integer('file_size').nullable();
    table.string('mime_type').nullable();
    table.jsonb('schema').nullable(); // data schema information
    table.jsonb('preview_data').nullable(); // first few rows for preview
    table.integer('row_count').nullable();
    table.jsonb('processing_config').nullable(); // AI processing settings
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
    
    table.index(['user_id']);
    table.index(['type']);
    table.index(['status']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('data_sources');
};

