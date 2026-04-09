namespace my.support;

using { cuid, managed } from '@sap/cds/common';

// ─────────────────────────────────────────────
// 1. TICKETS (Core Entity)
// ─────────────────────────────────────────────
entity Tickets : cuid, managed {
    // Basic Info
    title            : String(200);
    description      : LargeString;

    // Classification (AI - Service Ticket Intelligence)
    category         : String(50);   // e.g. Billing, Technical, General
    priority         : String(20);   // LOW, MEDIUM, HIGH, CRITICAL
    status           : String(20) default 'NEW'; // NEW, IN_PROGRESS, RESOLVED, CLOSED

    // Sentiment Analysis (AI - NLP)
    sentiment        : String(20);   // POSITIVE, NEUTRAL, NEGATIVE

    // Business Entity Recognition (AI - Extraction)
    customerName     : String(100);
    customerEmail    : String(200);
    product          : String(100);
    orderID          : String(50);

    // GenAI Output (SAP Generative AI Hub - LLM)
    suggestedSolution: LargeString;
    aiConfidenceScore: Decimal(4,2); // e.g. 0.95

    // Event Tracking
    eventStatus      : String(30) default 'PENDING'; // PENDING, PUBLISHED, PROCESSED

    // Compositions
    sla              : Composition of one SLATracking on sla.ticket = $self;
    comments         : Composition of many TicketComments on comments.ticket = $self;
}

// ─────────────────────────────────────────────
// 2. SLA TRACKING
// ─────────────────────────────────────────────
entity SLATracking : cuid {
    ticket           : Association to Tickets;
    targetResolutionTime : DateTime;
    actualResolutionTime : DateTime;
    slaBreached      : Boolean default false;
    breachReason     : String(200);
}

// ─────────────────────────────────────────────
// 3. TICKET COMMENTS (Agent / AI replies)
// ─────────────────────────────────────────────
entity TicketComments : cuid, managed {
    ticket           : Association to Tickets;
    commentText      : LargeString;
    commentedBy      : String(100);
    isAIGenerated    : Boolean default false;
}

// ─────────────────────────────────────────────
// 4. AI PROCESSING LOG (Audit Trail)
// ─────────────────────────────────────────────
entity AIProcessingLog : cuid {
    ticket           : Association to Tickets;
    processedAt      : DateTime;
    modelUsed        : String(100); // e.g. gpt-4, gemini-pro
    inputTokens      : Integer;
    outputTokens     : Integer;
    processingStatus : String(30);  // SUCCESS, FAILED, PARTIAL
    errorMessage     : String(500);
}