exports.up = function(knex) {
  return Promise.all([
    // Execution logs table
    knex.schema.createTable('execution_logs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('automation_id').references('id').inTable('automations').onDelete('CASCADE');
      table.string('execution_id').notNull();
      table.string('status').notNull(); // success, error, running
      table.jsonb('data').defaultTo('{}');
      table.timestamp('executed_at').defaultTo(knex.fn.now());
      table.timestamps(true, true);
      
      table.index(['automation_id', 'executed_at']);
      table.index(['execution_id']);
    }),

    // Message logs table
    knex.schema.createTable('message_logs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull(); // whatsapp, instagram, tiktok, etc.
      table.string('message_id').notNull();
      table.string('from_number');
      table.string('message_type');
      table.text('content');
      table.timestamp('timestamp').notNull();
      table.jsonb('metadata').defaultTo('{}');
      table.timestamps(true, true);
      
      table.index(['platform', 'message_id']);
      table.index(['timestamp']);
    }),

    // Engagement logs table
    knex.schema.createTable('engagement_logs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('engagement_type').notNull(); // comment, like, share, mention
      table.string('post_id');
      table.string('user_id');
      table.text('content');
      table.timestamp('timestamp').notNull();
      table.jsonb('metadata').defaultTo('{}');
      table.timestamps(true, true);
      
      table.index(['platform', 'post_id']);
      table.index(['engagement_type']);
    }),

    // Content logs table
    knex.schema.createTable('content_logs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('content_type').notNull(); // video, image, post
      table.string('content_id').notNull();
      table.string('title');
      table.text('description');
      table.timestamp('published_at').notNull();
      table.jsonb('metadata').defaultTo('{}');
      table.timestamps(true, true);
      
      table.index(['platform', 'content_id']);
      table.index(['published_at']);
    }),

    // Campaign analytics table
    knex.schema.createTable('campaign_analytics', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('campaign_id').notNull();
      table.integer('messages_sent').defaultTo(0);
      table.jsonb('channels_used').defaultTo('[]');
      table.integer('execution_time').defaultTo(0); // in seconds
      table.decimal('success_rate', 5, 2).defaultTo(0);
      table.timestamps(true, true);
      
      table.index(['campaign_id']);
    }),

    // Message analytics table
    knex.schema.createTable('message_analytics', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('message_id').notNull();
      table.string('status').notNull(); // sent, delivered, read, failed
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.timestamps(true, true);
      
      table.index(['platform', 'message_id']);
      table.index(['status']);
    }),

    // Post analytics table
    knex.schema.createTable('post_analytics', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('post_id').notNull();
      table.integer('likes').defaultTo(0);
      table.integer('comments').defaultTo(0);
      table.integer('shares').defaultTo(0);
      table.integer('views').defaultTo(0);
      table.timestamps(true, true);
      
      table.index(['platform', 'post_id']);
    }),

    // Content analytics table
    knex.schema.createTable('content_analytics', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('content_id').notNull();
      table.string('status').notNull(); // published, scheduled, failed
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.timestamps(true, true);
      
      table.index(['platform', 'content_id']);
      table.index(['status']);
    }),

    // Webhook tests table
    knex.schema.createTable('webhook_tests', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.boolean('test').defaultTo(true);
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.text('message');
      table.jsonb('data').defaultTo('{}');
      table.timestamps(true, true);
      
      table.index(['platform', 'timestamp']);
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTable('webhook_tests'),
    knex.schema.dropTable('content_analytics'),
    knex.schema.dropTable('post_analytics'),
    knex.schema.dropTable('message_analytics'),
    knex.schema.dropTable('campaign_analytics'),
    knex.schema.dropTable('content_logs'),
    knex.schema.dropTable('engagement_logs'),
    knex.schema.dropTable('message_logs'),
    knex.schema.dropTable('execution_logs')
  ]);
};
