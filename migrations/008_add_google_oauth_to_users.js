exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.string('google_id').nullable().unique();
    table.string('google_email').nullable();
    table.string('avatar_url').nullable();
    table.string('phone_number').nullable();
    table.boolean('phone_verified').defaultTo(false);
    table.timestamp('phone_verified_at').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('google_id');
    table.dropColumn('google_email');
    table.dropColumn('avatar_url');
    table.dropColumn('phone_number');
    table.dropColumn('phone_verified');
    table.dropColumn('phone_verified_at');
  });
};
