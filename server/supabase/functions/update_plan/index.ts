// Edge Function: update_plan
// Обновляет тренировочный план на основе прогресса пользователя

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface UpdatePlanRequest {
    profile_id: string;
    trigger: 'manual' | 'auto' | 'report_analysis';
    context?: {
        recent_sessions?: any[];
        adjustments?: any;
    };
}

serve(async (req) => {
    try {
        // Only allow POST requests
        if (req.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        // Get request body
        const body: UpdatePlanRequest = await req.json();
        const { profile_id, trigger, context } = body;

        if (!profile_id) {
            return new Response(
                JSON.stringify({ error: 'profile_id is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profile_id)
            .single();

        if (profileError || !profile) {
            return new Response(
                JSON.stringify({ error: 'Profile not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Fetch recent training sessions
        const { data: sessions } = await supabase
            .from('training_sessions')
            .select('*')
            .eq('profile_id', profile_id)
            .order('date', { ascending: false })
            .limit(10);

        // Here we would call OpenAI to generate a new plan
        // For now, return a placeholder response

        // Create new plan version
        const { data: latestVersion } = await supabase
            .from('plan_versions')
            .select('version')
            .eq('profile_id', profile_id)
            .order('version', { ascending: false })
            .limit(1)
            .single();

        const newVersion = (latestVersion?.version || 0) + 1;

        const { data: newPlanVersion, error: versionError } = await supabase
            .from('plan_versions')
            .insert({
                profile_id,
                version: newVersion,
                summary: {
                    trigger,
                    created_at: new Date().toISOString(),
                    adjustments: context?.adjustments || {},
                },
                is_active: true,
            })
            .select()
            .single();

        if (versionError) {
            console.error('Error creating plan version:', versionError);
            throw versionError;
        }

        // Deactivate previous versions
        await supabase
            .from('plan_versions')
            .update({ is_active: false, deactivated_at: new Date().toISOString() })
            .eq('profile_id', profile_id)
            .neq('id', newPlanVersion.id);

        // Log the operation
        await supabase.from('operation_log').insert({
            profile_id,
            action: 'plan_updated',
            status: 'success',
            payload_hash: `v${newVersion}`,
        });

        // Log observability event
        await supabase.from('observability_events').insert({
            profile_id,
            category: 'plan_update',
            severity: 'info',
            payload: {
                version: newVersion,
                trigger,
                session_count: sessions?.length || 0,
            },
        });

        return new Response(
            JSON.stringify({
                success: true,
                plan_version: newPlanVersion,
                message: 'Plan updated successfully',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in update_plan function:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
});

