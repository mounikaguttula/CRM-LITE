const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');


const getClient = () => supabaseAdmin || supabase;


/**
 * Start a user login session (Creates 1 row in audit_logs with an activities array and last_activity_at).
 */
const startSession = async ({ organization_id, user_id, user_email, name }) => {
    try {
        if (!user_id || !organization_id) return;
        const client = getClient();
        const nowIso = new Date().toISOString();

        const { data, error } = await client
            .from('audit_logs')
            .insert([{
                organization_id,
                user_id,
                event_type: 'LOGIN',
                details: {
                    name: name || 'User',
                    email: user_email,
                    activities: [],
                    last_activity_at: nowIso,
                },
                created_at: nowIso,
            }])
            .select()
            .single();

        if (error) {
            console.error('❌ Error starting audit log session:', error.message);
        } else {
            console.log(`✅ [AUDIT SESSION CREATED] User: ${user_id} | Session ID: ${data?.id}`);
        }
    } catch (err) {
        console.error('❌ startSession exception:', err.message);
    }
};


/**
 * Update the last_activity_at timestamp for the user's active LOGIN session.
 */
const updateLastActivity = async ({ organization_id, user_id }) => {
    try {
        if (!user_id || !organization_id) return;
        const client = getClient();

        const { data: sessionRow, error: fetchErr } = await client
            .from('audit_logs')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('user_id', user_id)
            .eq('event_type', 'LOGIN')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchErr || !sessionRow) return;

        const currentDetails = sessionRow.details || {};
        const updatedDetails = {
            ...currentDetails,
            last_activity_at: new Date().toISOString(),
        };

        await client
            .from('audit_logs')
            .update({ details: updatedDetails })
            .eq('id', sessionRow.id);
    } catch (err) {
        console.error('❌ updateLastActivity exception:', err.message);
    }
};


/**
 * Log a user activity (e.g. UPDATE lead) by updating the JSONB activities array in the user's active session row.
 */
const logUserActivity = async ({ organization_id, user_id, action, module, record_id, description, metadata = {} }) => {
    try {
        if (!user_id || !organization_id) return;
        const client = getClient();

        // 1. Find the latest active LOGIN session row for this user & organization
        const { data: sessionRow, error: fetchErr } = await client
            .from('audit_logs')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('user_id', user_id)
            .eq('event_type', 'LOGIN')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchErr || !sessionRow) {
            console.warn('⚠️ No active session audit row found.');
            return;
        }

        const nowIso = new Date().toISOString();
        const cleanModule = module ? String(module).toLowerCase() : 'general';
        const cleanAction = action ? String(action).toUpperCase() : 'USER_ACTION';
        const descText = description || metadata.description || `${cleanAction.charAt(0) + cleanAction.slice(1).toLowerCase()} ${cleanModule}`;

        // 2. Prepare activity item
        const newActivity = {
            action: cleanAction,
            module: cleanModule,
            record_id: record_id || null,
            timestamp: nowIso,
            description: descText,
        };

        // 3. Append to details.activities array
        const currentDetails = sessionRow.details || {};
        const existingActivities = Array.isArray(currentDetails.activities) ? currentDetails.activities : [];
        const updatedActivities = [...existingActivities, newActivity];

        const updatedDetails = {
            ...currentDetails,
            activities: updatedActivities,
            last_activity_at: nowIso,
        };

        // 4. Update the single audit log row in Supabase
        const { error: updateErr } = await client
            .from('audit_logs')
            .update({ details: updatedDetails })
            .eq('id', sessionRow.id);

        if (updateErr) {
            console.error('❌ Error updating session audit log JSONB:', updateErr.message);
        } else {
            console.log(`✅ [AUDIT ACTIVITY APPENDED] Session: ${sessionRow.id} | Action: ${cleanAction} on ${cleanModule}`);
        }
    } catch (err) {
        console.error('❌ logUserActivity exception:', err.message);
    }
};


/**
 * End a user session (LOGOUT / SESSION_EXPIRED) by updating the active session row's details JSONB.
 */
const endSession = async ({ organization_id, user_id, reason = 'LOGOUT', logout_reason = null }) => {
    try {
        if (!user_id || !organization_id) return;
        const client = getClient();

        const { data: sessionRow } = await client
            .from('audit_logs')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('user_id', user_id)
            .eq('event_type', 'LOGIN')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (sessionRow) {
            const currentDetails = sessionRow.details || {};
            const effectiveEventType = (reason === 'SESSION_EXPIRED' || logout_reason === 'IDLE_TIMEOUT') ? 'SESSION_EXPIRED' : 'LOGOUT';
            const effectiveReason = logout_reason || (effectiveEventType === 'SESSION_EXPIRED' ? 'IDLE_TIMEOUT' : 'LOGOUT');
            const nowIso = new Date().toISOString();

            const updatedDetails = {
                ...currentDetails,
                logged_out_at: nowIso,
                logout_reason: effectiveReason,
            };

            await client
                .from('audit_logs')
                .update({
                    event_type: effectiveEventType,
                    details: updatedDetails
                })
                .eq('id', sessionRow.id);

            console.log(`✅ [AUDIT SESSION ENDED] User: ${user_id} | Event: ${effectiveEventType} | Reason: ${effectiveReason}`);
        }
    } catch (err) {
        console.error('❌ endSession exception:', err.message);
    }
};


module.exports = {
    startSession,
    updateLastActivity,
    logUserActivity,
    endSession,
    logAuditEvent: startSession, // Backward compatibility
};



