exports.up = function(knex) {
  return knex.schema.createTable('ai_insights', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('data_source_id').references('id').inTable('data_sources').onDelete('CASCADE');
    table.string('type').notNullable(); // analysis, prediction, recommendation, classification
    table.string('title').notNullable();
    table.text('description').notNullable();
    table.jsonb('insight_data').notNullable(); // structured insight data
    table.jsonb('ai_model_info').nullable(); // model used, confidence scores, etc.
    table.string('status').defaultTo('generating').notNullable(); // generating, completed, error
    table.decimal('confidence_score', 3, 2).nullable(); // 0.00 to 1.00
    table.jsonb('tags').nullable(); // categorization tags
    table.boolean('is_favorite').defaultTo(false);
    table.timestamp('generated_at').nullable();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
    
    table.index(['user_id']);
    table.index(['data_source_id']);
    table.index(['type']);
    table.index(['status']);
    table.index(['confidence_score']);
    table.index(['generated_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('ai_insights');
};

