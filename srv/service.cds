using my.support from '../db/schema';

service SupportService {

    @odata.draft.enabled
    entity Tickets as projection on support.Tickets;

    entity SLATracking as projection on support.SLATracking;

    entity TicketComments as projection on support.TicketComments;

    @readonly
    entity AIProcessingLog as projection on support.AIProcessingLog;

    action analyzeTicket(ticketId: UUID) returns {
        category         : String;
        priority         : String;
        sentiment        : String;
        customerName     : String;
        product          : String;
        orderID          : String;
        suggestedSolution: String;
        aiConfidenceScore: Decimal;
    };

    action sendReply(
        ticketId    : UUID,
        replyText   : String null
    ) returns {
        success : Boolean;
        message : String;
    };

    action createTicketFromEmail(
        title         : String,
        description   : String,
        customerEmail : String
    ) returns {
        ID       : UUID;
        title    : String;
        status   : String;
        priority : String;
    };
}
