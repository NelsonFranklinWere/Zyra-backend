exports.up = function(knex) {
  return knex.schema.createTable('otp_verifications', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('email').nullable();
    table.string('phone_number').nullable();
    table.string('otp_code').notNullable();
    table.string('verification_type').notNullable(); // 'email' or 'sms'
    table.boolean('is_verified').defaultTo(false);
    table.timestamp('expires_at').notNullable();
    table.timestamp('verified_at').nullable();
    table.integer('attempts').defaultTo(0);
    table.timestamps(true, true);
    
    table.index(['user_id']);
    table.index(['email']);
    table.index(['phone_number']);
    table.index(['otp_code']);
    table.index(['expires_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('otp_verifications');
};
