exports.up = function(knex) {
  return knex.schema
    // WhatsApp Messages
    .createTable('whatsapp_messages', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('to_number').notNullable();
      table.text('message_content').notNullable();
      table.string('media_url').nullable();
      table.string('direction').notNullable(); // inbound, outbound
      table.string('status').defaultTo('sent'); // sent, delivered, read, failed
      table.string('message_id').nullable(); // Twilio message SID
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['to_number']);
      table.index(['direction']);
      table.index(['created_at']);
    })
    
    // WhatsApp Settings
    .createTable('whatsapp_settings', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.boolean('auto_reply').defaultTo(false);
      table.string('business_hours').defaultTo('9:00-17:00');
      table.string('timezone').defaultTo('UTC');
      table.text('welcome_message').nullable();
      table.text('away_message').nullable();
      table.jsonb('auto_reply_rules').defaultTo('[]');
      table.timestamps(true, true);
      
      table.index(['user_id']);
    })
    
    // WhatsApp Broadcasts
    .createTable('whatsapp_broadcasts', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('name').notNullable();
      table.text('message').notNullable();
      table.jsonb('recipients').notNullable(); // Array of phone numbers
      table.timestamp('scheduled_at').nullable();
      table.string('status').defaultTo('pending'); // pending, sending, completed, failed
      table.integer('total_recipients').defaultTo(0);
      table.integer('sent_count').defaultTo(0);
      table.integer('delivered_count').defaultTo(0);
      table.integer('failed_count').defaultTo(0);
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['status']);
      table.index(['scheduled_at']);
    })
    
    // WhatsApp Templates
    .createTable('whatsapp_templates', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('name').notNullable();
      table.text('content').notNullable();
      table.string('category').defaultTo('general'); // greeting, support, sales, etc.
      table.jsonb('variables').defaultTo('[]'); // Template variables
      table.boolean('is_active').defaultTo(true);
      table.integer('usage_count').defaultTo(0);
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['category']);
      table.index(['is_active']);
    })
    
    // WhatsApp Analytics
    .createTable('whatsapp_analytics', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.date('date').notNullable();
      table.integer('messages_sent').defaultTo(0);
      table.integer('messages_received').defaultTo(0);
      table.integer('unique_contacts').defaultTo(0);
      table.float('response_time_avg').nullable();
      table.jsonb('engagement_metrics').defaultTo('{}');
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['date']);
      table.unique(['user_id', 'date']);
    })
    
    // Support Tickets
    .createTable('support_tickets', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('ticket_id').notNullable().unique();
      table.string('phone_number').notNullable();
      table.string('subject').nullable();
      table.text('description').nullable();
      table.string('status').defaultTo('open'); // open, in_progress, resolved, closed
      table.string('priority').defaultTo('medium'); // low, medium, high, urgent
      table.string('category').nullable(); // technical, billing, general
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['status']);
      table.index(['priority']);
      table.index(['created_at']);
    })
    
    // Demo Requests
    .createTable('demo_requests', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('phone_number').notNullable();
      table.string('business_type').nullable();
      table.text('requirements').nullable();
      table.string('preferred_date').nullable();
      table.string('preferred_time').nullable();
      table.string('status').defaultTo('pending'); // pending, scheduled, completed, cancelled
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['status']);
      table.index(['created_at']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('demo_requests')
    .dropTable('support_tickets')
    .dropTable('whatsapp_analytics')
    .dropTable('whatsapp_templates')
    .dropTable('whatsapp_broadcasts')
    .dropTable('whatsapp_settings')
    .dropTable('whatsapp_messages');
};
