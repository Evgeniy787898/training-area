// Edge Function: notify_daily
// Отправляет ежедневные уведомления о тренировках

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
    try {
        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get Telegram bot token
        const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        if (!telegramToken) {
            throw new Error('TELEGRAM_BOT_TOKEN not configured');
        }

        // Get current date
        const today = new Date().toISOString().split('T')[0];

        // Fetch all profiles with notifications enabled
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, telegram_id, notification_time, timezone, notifications_paused')
            .eq('notifications_paused', false);

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            throw profilesError;
        }

        console.log(`Processing notifications for ${profiles?.length || 0} profiles`);

        let successCount = 0;
        let errorCount = 0;

        // Process each profile
        for (const profile of profiles || []) {
            try {
                // Check if there's a training session for today
                const { data: session } = await supabase
                    .from('training_sessions')
                    .select('*')
                    .eq('profile_id', profile.id)
                    .eq('date', today)
                    .eq('status', 'planned')
                    .single();

                if (!session) {
                    console.log(`No training session for profile ${profile.id} today`);
                    continue;
                }

                // Format notification message
                const message = formatNotificationMessage(session);

                // Send Telegram notification
                const telegramResponse = await fetch(
                    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: profile.telegram_id,
                            text: message,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: '📋 Подробнее', callback_data: 'plan_today' },
                                        { text: '✅ Начать', callback_data: `session_start_${session.id}` },
                                    ],
                                ],
                            },
                        }),
                    }
                );

                if (telegramResponse.ok) {
                    successCount++;

                    // Log successful notification
                    await supabase.from('operation_log').insert({
                        profile_id: profile.id,
                        action: 'notification_sent',
                        status: 'success',
                    });
                } else {
                    errorCount++;
                    const errorData = await telegramResponse.json();
                    console.error(`Failed to send notification to ${profile.telegram_id}:`, errorData);

                    // Log failed notification
                    await supabase.from('operation_log').insert({
                        profile_id: profile.id,
                        action: 'notification_sent',
                        status: 'error',
                        error_code: errorData.error_code || 'telegram_api_error',
                    });
                }

            } catch (error) {
                errorCount++;
                console.error(`Error processing profile ${profile.id}:`, error);
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                processed: profiles?.length || 0,
                sent: successCount,
                errors: errorCount,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in notify_daily function:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
});

function formatNotificationMessage(session: any): string {
    const exercises = session.exercises || [];

    let message = `🏋️ **Доброе утро! Сегодня тренировка**\n\n`;

    if (session.session_type) {
        message += `**Тип:** ${session.session_type}\n\n`;
    }

    if (exercises.length > 0) {
        message += `**Упражнения:**\n`;
        exercises.slice(0, 3).forEach((ex: any, i: number) => {
            message += `${i + 1}. ${ex.name || ex.exercise_key}`;
            if (ex.sets && ex.reps) {
                message += ` — ${ex.sets}×${ex.reps}`;
            }
            message += '\n';
        });

        if (exercises.length > 3) {
            message += `... и ещё ${exercises.length - 3}\n`;
        }
    }

    message += `\n💪 Давай сделаем это!`;

    return message;
}

