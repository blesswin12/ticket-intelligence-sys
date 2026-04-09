const cds = require('@sap/cds');

module.exports = class SupportService extends cds.ApplicationService {

    async init() {
        const { Tickets, SLATracking, AIProcessingLog } = this.entities;

        this.after('SAVE', Tickets, async (ticket, req) => {
            if (ticket.ID && ticket.description && !ticket.category) {
                try {
                    await this._runAIAnalysis(ticket.ID, ticket.title, ticket.description, req);
                } catch (err) {
                    req.warn(`AI analysis could not be completed: ${err.message}`);
                }
            }
        });

        this.on('analyzeTicket', async (req) => {
            const { ticketId } = req.data;
            const ticket = await SELECT.one.from(Tickets).where({ ID: ticketId });
            if (!ticket) return req.error(404, `Ticket ${ticketId} not found`);
            return await this._runAIAnalysis(ticket.ID, ticket.title, ticket.description, req);
        });

        this.after('SAVE', Tickets, async (ticket) => {
            const priorityHours = { 'CRITICAL': 4, 'HIGH': 8, 'MEDIUM': 24, 'LOW': 72 };
            const hours = priorityHours[ticket.priority] || 24;
            const targetTime = new Date();
            targetTime.setHours(targetTime.getHours() + hours);
            await INSERT.into(SLATracking).entries({
                ticket_ID:            ticket.ID,
                targetResolutionTime: targetTime.toISOString(),
                slaBreached:          false
            });
        });

        // ── External ticket creation (bypasses draft for email listener) ──
        this.on('createTicketFromEmail', async (req) => {
            const { title, description, customerEmail } = req.data;
            const { Tickets, SLATracking } = this.entities;

            // Insert directly as active entity
            const id = cds.utils.uuid();
            await INSERT.into(Tickets).entries({
                ID:           id,
                title:        title || 'Support Request',
                description:  description || '',
                status:       'NEW',
                eventStatus:  'PENDING',
                customerEmail: customerEmail || ''
            });

            // Set SLA
            const targetTime = new Date();
            targetTime.setHours(targetTime.getHours() + 24);
            await INSERT.into(SLATracking).entries({
                ticket_ID:            id,
                targetResolutionTime: targetTime.toISOString(),
                slaBreached:          false
            });

            // Trigger AI analysis
            try {
                await this._runAIAnalysis(id, title, description, req);
            } catch(e) {
                console.error('[createTicketFromEmail] AI failed:', e.message);
            }

            const ticket = await SELECT.one.from(Tickets).where({ ID: id });
            return ticket;
        });


        // ── Send Reply Email ──────────────────────────────────────────────
        this.on('sendReply', async (req) => {
            const { ticketId } = req.data;
            let { replyText } = req.data;
            const { Tickets } = this.entities;

            const ticket = await SELECT.one.from(Tickets).where({ ID: ticketId });
            if (!ticket) return req.error(404, 'Ticket not found');
            if (!ticket.customerEmail) return req.error(400, 'No customer email on this ticket');
            // Use suggested solution if no reply text provided
            if (!replyText) replyText = ticket.suggestedSolution || 'Thank you for contacting us. We are looking into your issue and will get back to you shortly.';

            try {
                const { google } = require('googleapis');
                const fs = require('fs');
                const path = require('path');

                let credentials, token;
                if (process.env.GMAIL_CREDENTIALS) {
                    credentials = JSON.parse(process.env.GMAIL_CREDENTIALS);
                    token = JSON.parse(process.env.GMAIL_TOKEN);
                } else {
                    credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../email-listener/credentials.json')));
                    token = JSON.parse(fs.readFileSync(path.join(__dirname, '../email-listener/token.json')));
                }
                const { client_secret, client_id, redirect_uris } = credentials.installed;
                const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
                oAuth2Client.setCredentials(token);

                const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
                const ticketRef = ticket.ID.slice(0,8).toUpperCase();

                const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                    <div style="background:#0070f3;padding:20px;border-radius:8px 8px 0 0">
                        <h2 style="color:white;margin:0">Support Response</h2>
                    </div>
                    <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
                        <p>Dear ${ticket.customerName || 'Customer'},</p>
                        <p>Thank you for contacting our support team. Here is our response:</p>
                        <div style="background:#f5f5f5;padding:16px;border-left:4px solid #0070f3;border-radius:4px;margin:16px 0">
                            <p style="margin:0">${replyText}</p>
                        </div>
                        <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">
                        <p style="color:#666;font-size:13px">Ticket ID: ${ticketRef} | Category: ${ticket.category || 'N/A'} | Priority: ${ticket.priority || 'N/A'}</p>
                        <p style="color:#666;font-size:12px">This is an automated response. Please do not reply to this email.</p>
                    </div>
                </div>`;

                const rawMessage = [
                    `To: ${ticket.customerEmail}`,
                    `Subject: Re: [Ticket #${ticketRef}] ${ticket.title}`,
                    `MIME-Version: 1.0`,
                    `Content-Type: text/html; charset=utf-8`,
                    ``,
                    htmlBody
                ].join('\n');

                const encoded = Buffer.from(rawMessage).toString('base64')
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

                await gmail.users.messages.send({
                    userId: 'me',
                    requestBody: { raw: encoded }
                });

                console.log('[sendReply] ✅ Reply sent to', ticket.customerEmail);

                await UPDATE(Tickets).set({
                    status: 'RESOLVED',
                    suggestedSolution: replyText
                }).where({ ID: ticketId });

                return { success: true, message: `Reply sent to ${ticket.customerEmail}` };

            } catch (err) {
                console.error('[sendReply] ❌ Error:', err.message);
                return req.error(500, `Failed to send email: ${err.message}`);
            }
        });
        await super.init();
    }

    async _runAIAnalysis(ticketId, title, description, req) {
        const { Tickets, AIProcessingLog } = this.entities;
        let processingStatus = 'SUCCESS';
        let errorMessage = null;
        let result = {};

        try {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) throw new Error('GROQ_API_KEY not set in environment');

            const prompt = `You are an AI support ticket analyst. Analyze the following support ticket and respond ONLY with a valid JSON object. No explanation, no markdown, no code blocks.

Ticket Title: ${title || 'No title'}
Ticket Description: ${description || 'No description'}

Respond with exactly this JSON structure:
{
  "category": "one of: Billing, Technical, General, Shipping, Returns, Account",
  "priority": "one of: LOW, MEDIUM, HIGH, CRITICAL",
  "sentiment": "one of: POSITIVE, NEUTRAL, NEGATIVE",
  "customerName": "extracted customer name or empty string",
  "product": "extracted product name or empty string",
  "orderID": "extracted order ID or empty string",
  "suggestedSolution": "a helpful 2-3 sentence suggested solution",
  "aiConfidenceScore": 0.95
}`;

            const Groq = require('groq-sdk');
            const groq = new Groq({ apiKey });

            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: 500
            });

            const content = chatCompletion.choices[0]?.message?.content || '';
            console.log(`[AI Analysis] Groq raw response:`, content);

            const clean = content.replace(/```json|```/g, '').trim();
            const jsonMatch = clean.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('AI response did not contain valid JSON');

            result = JSON.parse(jsonMatch[0]);
            console.log(`[AI Analysis] ✅ Parsed result for ticket ${ticketId}:`, result);

            await UPDATE(Tickets).set({
                category:          result.category          || null,
                priority:          result.priority          || 'MEDIUM',
                sentiment:         result.sentiment         || 'NEUTRAL',
                customerName:      result.customerName      || null,
                product:           result.product           || null,
                orderID:           result.orderID           || null,
                suggestedSolution: result.suggestedSolution || null,
                aiConfidenceScore: result.aiConfidenceScore || 0.80,
                eventStatus:       'PROCESSED'
            }).where({ ID: ticketId });

        } catch (err) {
            processingStatus = 'FAILED';
            errorMessage = err.message;
            console.error(`[AI Analysis] ❌ Failed for ticket ${ticketId}:`, err.message);

            await UPDATE(Tickets).set({
                priority:    'MEDIUM',
                status:      'NEW',
                eventStatus: 'PENDING'
            }).where({ ID: ticketId });
        }

        await INSERT.into(AIProcessingLog).entries({
            ticket_ID:        ticketId,
            processedAt:      new Date().toISOString(),
            modelUsed:        'llama-3.3-70b-versatile',
            processingStatus: processingStatus,
            errorMessage:     errorMessage,
            inputTokens:      Math.ceil(((title || '') + (description || '')).length / 4),
            outputTokens:     Math.ceil(JSON.stringify(result).length / 4)
        });

        return result;
    }
};