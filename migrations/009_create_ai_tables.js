exports.up = function(knex) {
  return knex.schema
    // AI Prompt Templates
    .createTable('ai_prompt_templates', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable().unique();
      table.text('content').notNullable();
      table.string('module').notNullable(); // cv_builder, social_generator, etc.
      table.jsonb('variables').defaultTo('{}');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      table.index(['module']);
      table.index(['is_active']);
    })
    
    // AI Generations (General)
    .createTable('ai_generations', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('module').notNullable(); // cv_builder, social_generator, etc.
      table.jsonb('input_data').notNullable();
      table.jsonb('output_data').notNullable();
      table.jsonb('metadata').defaultTo('{}');
      table.float('confidence_score').nullable();
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['module']);
      table.index(['created_at']);
    })
    
    // User CVs
    .createTable('user_cvs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.jsonb('cv_data').notNullable();
      table.jsonb('preferences').defaultTo('{}');
      table.text('generated_cv').notNullable();
      table.string('format').defaultTo('markdown');
      table.boolean('is_public').defaultTo(false);
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['is_public']);
    })
    
    // User Social Posts
    .createTable('user_social_posts', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.jsonb('content').notNullable();
      table.string('platform').notNullable();
      table.jsonb('preferences').defaultTo('{}');
      table.text('generated_post').notNullable();
      table.integer('engagement_score').nullable();
      table.jsonb('hashtags').defaultTo('[]');
      table.integer('character_count').nullable();
      table.boolean('is_published').defaultTo(false);
      table.timestamp('scheduled_at').nullable();
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['platform']);
      table.index(['is_published']);
      table.index(['scheduled_at']);
    })
    
    // WhatsApp Interactions
    .createTable('whatsapp_interactions', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.text('incoming_message').notNullable();
      table.jsonb('context').defaultTo('{}');
      table.text('ai_response').notNullable();
      table.string('intent').nullable();
      table.float('confidence').nullable();
      table.jsonb('suggested_actions').defaultTo('[]');
      table.boolean('is_responded').defaultTo(false);
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['intent']);
      table.index(['created_at']);
    })
    
    // User Insights
    .createTable('user_insights', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.jsonb('input_data').notNullable();
      table.string('analysis_type').defaultTo('general');
      table.text('insights').notNullable();
      table.jsonb('key_metrics').defaultTo('[]');
      table.jsonb('recommendations').defaultTo('[]');
      table.float('confidence_score').nullable();
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['analysis_type']);
    })
    
    // User Audience Segments
    .createTable('user_audience_segments', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.jsonb('criteria').notNullable();
      table.jsonb('preferences').defaultTo('{}');
      table.text('segments').notNullable();
      table.jsonb('targeting_strategies').defaultTo('[]');
      table.jsonb('engagement_tips').defaultTo('[]');
      table.integer('market_potential').nullable();
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['market_potential']);
    })
    
    // User AI Preferences
    .createTable('user_ai_preferences', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.jsonb('preferences').defaultTo('{}');
      table.string('ai_model_preference').defaultTo('gpt-4');
      table.string('tone_preference').defaultTo('professional');
      table.string('language_preference').defaultTo('en');
      table.timestamps(true, true);
      
      table.index(['user_id']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('user_ai_preferences')
    .dropTable('user_audience_segments')
    .dropTable('user_insights')
    .dropTable('whatsapp_interactions')
    .dropTable('user_social_posts')
    .dropTable('user_cvs')
    .dropTable('ai_generations')
    .dropTable('ai_prompt_templates');
};
