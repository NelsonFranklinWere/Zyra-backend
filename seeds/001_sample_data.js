const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del();
  await knex('ai_prompt_templates').del();
  await knex('user_ai_preferences').del();

  // Insert sample users
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const users = await knex('users').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'admin@zyra.ai',
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true,
      is_verified: true,
      preferences: JSON.stringify({
        theme: 'dark',
        notifications: true,
        language: 'en'
      })
    },
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'demo@zyra.ai',
      password_hash: hashedPassword,
      first_name: 'Demo',
      last_name: 'User',
      role: 'user',
      is_active: true,
      is_verified: true,
      preferences: JSON.stringify({
        theme: 'dark',
        notifications: true,
        language: 'en'
      })
    },
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'test@zyra.ai',
      password_hash: hashedPassword,
      first_name: 'Test',
      last_name: 'User',
      role: 'user',
      is_active: true,
      is_verified: true,
      preferences: JSON.stringify({
        theme: 'light',
        notifications: false,
        language: 'en'
      })
    }
  ]).returning('*');

  // Insert AI prompt templates
  await knex('ai_prompt_templates').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'cv_builder',
      content: 'Generate a professional CV based on the provided user data. Focus on modern formatting, ATS optimization, and industry-specific keywords.',
      module: 'cv_builder',
      variables: JSON.stringify(['personalInfo', 'experience', 'education', 'skills']),
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'social_generator',
      content: 'Create engaging social media content optimized for the specified platform. Include relevant hashtags and call-to-action.',
      module: 'social_generator',
      variables: JSON.stringify(['content', 'platform', 'tone', 'audience']),
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'whatsapp_automation',
      content: 'Analyze the incoming WhatsApp message and generate an appropriate business response. Maintain professional tone while being helpful.',
      module: 'whatsapp_automation',
      variables: JSON.stringify(['message', 'context', 'business_type']),
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'data_insights',
      content: 'Analyze the provided data and generate actionable business insights. Focus on trends, patterns, and recommendations.',
      module: 'data_insights',
      variables: JSON.stringify(['data', 'analysis_type', 'metrics']),
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'audience_targeting',
      content: 'Create detailed audience segments based on the targeting criteria. Include demographic and psychographic characteristics.',
      module: 'audience_targeting',
      variables: JSON.stringify(['criteria', 'preferences', 'market_size']),
      is_active: true
    }
  ]);

  // Insert user AI preferences
  for (const user of users) {
    await knex('user_ai_preferences').insert({
      id: knex.raw('gen_random_uuid()'),
      user_id: user.id,
      preferences: JSON.stringify({
        tone: 'professional',
        creativity: 'balanced',
        length: 'medium'
      }),
      ai_model_preference: 'gpt-4',
      tone_preference: 'professional',
      language_preference: 'en'
    });
  }

  console.log('✅ Sample data seeded successfully!');
  console.log('📋 Created users:');
  console.log('   - admin@zyra.ai (password: password123)');
  console.log('   - demo@zyra.ai (password: password123)');
  console.log('   - test@zyra.ai (password: password123)');
};
