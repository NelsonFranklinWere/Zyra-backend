exports.up = async function(knex) {
  const tables = [
    { name: 'execution_logs', create: (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('automation_id').references('id').inTable('automations').onDelete('CASCADE');
      table.string('execution_id').notNull();
      table.string('status').notNull();
      table.jsonb('data').defaultTo('{}');
      table.timestamp('executed_at').defaultTo(knex.fn.now());
      table.timestamps(true, true);
      table.index(['automation_id', 'executed_at']);
      table.index(['execution_id']);
    }},
    { name: 'message_logs', create: (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('message_id').notNull();
      table.string('from_number');
      table.string('message_type');
      table.text('content');
      table.timestamp('timestamp').notNull();
      table.jsonb('metadata').defaultTo('{}');
      table.timestamps(true, true);
      table.index(['platform', 'message_id']);
      table.index(['timestamp']);
    }},
    { name: 'engagement_logs', create: (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('engagement_type').notNull();
      table.string('post_id');
      table.string('user_id');
      table.text('content');
      table.timestamp('timestamp').notNull();
      table.jsonb('metadata').defaultTo('{}');
      table.timestamps(true, true);
      table.index(['platform', 'post_id']);
      table.index(['engagement_type']);
    }},
    { name: 'content_logs', create: (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('content_type').notNull();
      table.string('content_id').notNull();
      table.string('title');
      table.text('description');
      table.timestamp('published_at').notNull();
      table.jsonb('metadata').defaultTo('{}');
      table.timestamps(true, true);
      table.index(['platform', 'content_id']);
      table.index(['published_at']);
    }},
    { name: 'campaign_analytics', create: (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('campaign_id').notNull();
      table.integer('messages_sent').defaultTo(0);
      table.jsonb('channels_used').defaultTo('[]');
      table.integer('execution_time').defaultTo(0);
      table.decimal('success_rate', 5, 2).defaultTo(0);
      table.timestamps(true, true);
      table.index(['campaign_id']);
    }},
    { name: 'message_analytics', create: (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('message_id').notNull();
      table.string('status').notNull();
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.timestamps(true, true);
      table.index(['platform', 'message_id']);
      table.index(['status']);
    }},
    { name: 'post_analytics', create: (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('post_id').notNull();
      table.integer('likes').defaultTo(0);
      table.integer('comments').defaultTo(0);
      table.integer('shares').defaultTo(0);
      table.integer('views').defaultTo(0);
      table.timestamps(true, true);
      table.index(['platform', 'post_id']);
    }},
    { name: 'content_analytics', create: (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.string('content_id').notNull();
      table.string('status').notNull();
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.timestamps(true, true);
      table.index(['platform', 'content_id']);
      table.index(['status']);
    }},
    { name: 'webhook_tests', create: (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('platform').notNull();
      table.boolean('test').defaultTo(true);
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.text('message');
      table.jsonb('data').defaultTo('{}');
      table.timestamps(true, true);
      table.index(['platform', 'timestamp']);
    }}
  ];

  for (const { name, create } of tables) {
    const exists = await knex.schema.hasTable(name);
    if (!exists) {
      await knex.schema.createTable(name, create);
    }
  }
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('webhook_tests'),
    knex.schema.dropTableIfExists('content_analytics'),
    knex.schema.dropTableIfExists('post_analytics'),
    knex.schema.dropTableIfExists('message_analytics'),
    knex.schema.dropTableIfExists('campaign_analytics'),
    knex.schema.dropTableIfExists('content_logs'),
    knex.schema.dropTableIfExists('engagement_logs'),
    knex.schema.dropTableIfExists('message_logs'),
    knex.schema.dropTableIfExists('execution_logs')
  ]);
};
