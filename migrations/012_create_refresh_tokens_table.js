exports.up = function(knex) {
  return knex.schema.createTable('refresh_tokens', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.text('token').notNullable().unique();
    table.timestamp('expires_at').notNullable();
    table.boolean('revoked').defaultTo(false);
    table.timestamp('revoked_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['user_id']);
    table.index(['token']);
    table.index(['expires_at']);
    table.index(['revoked']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('refresh_tokens');
};

