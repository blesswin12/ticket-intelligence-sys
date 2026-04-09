using SupportService as service from '../../srv/service';

annotate service.Tickets with @(

    UI.HeaderInfo: {
        TypeName       : 'Support Ticket',
        TypeNamePlural : 'Support Tickets',
        Title          : { $Type: 'UI.DataField', Value: title },
        Description    : { $Type: 'UI.DataField', Value: description }
    },

    UI.HeaderFacets: [
        { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Priority' },
        { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Status' },
        { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Sentiment' },
        { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#AIScore' }
    ],

    UI.DataPoint #Priority: { Value: priority, Title: 'Priority' },
    UI.DataPoint #Status:   { Value: status,   Title: 'Status' },
    UI.DataPoint #Sentiment:{ Value: sentiment, Title: 'Sentiment' },
    UI.DataPoint #AIScore:  { Value: aiConfidenceScore, Title: 'AI Confidence' },

    UI.SelectionFields: [ status, priority, category, sentiment ],

    UI.LineItem: [
        { $Type: 'UI.DataField', Value: title,             Label: 'Title' },
        { $Type: 'UI.DataField', Value: customerName,      Label: 'Customer' },
        { $Type: 'UI.DataField', Value: priority,          Label: 'Priority' },
        { $Type: 'UI.DataField', Value: status,            Label: 'Status' },
        { $Type: 'UI.DataField', Value: category,          Label: 'Category' },
        { $Type: 'UI.DataField', Value: sentiment,         Label: 'Sentiment' },
        { $Type: 'UI.DataField', Value: aiConfidenceScore, Label: 'AI Score' },
        { $Type: 'UI.DataField', Value: createdAt,         Label: 'Created' }
    ],

    UI.Facets: [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'TicketInfoFacet',
            Label  : 'Ticket Information',
            Target : '@UI.FieldGroup#TicketInfo'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'AIFacet',
            Label  : 'AI Analysis Results',
            Target : '@UI.FieldGroup#AIInsights'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'SolutionFacet',
            Label  : 'Suggested Solution',
            Target : '@UI.FieldGroup#Solution'
        }
    ],

    UI.FieldGroup #TicketInfo: {
        $Type : 'UI.FieldGroupType',
        Label : 'Ticket Information',
        Data  : [
            { $Type: 'UI.DataField', Value: title,         Label: 'Title' },
            { $Type: 'UI.DataField', Value: status,        Label: 'Status' },
            { $Type: 'UI.DataField', Value: priority,      Label: 'Priority' },
            { $Type: 'UI.DataField', Value: category,      Label: 'Category' },
            { $Type: 'UI.DataField', Value: description,   Label: 'Full Description' },
            { $Type: 'UI.DataField', Value: createdAt,     Label: 'Created At' },
            { $Type: 'UI.DataField', Value: createdBy,     Label: 'Created By' },
            { $Type: 'UI.DataField', Value: customerEmail, Label: 'Customer Email' }
        ]
    },

    UI.FieldGroup #AIInsights: {
        $Type : 'UI.FieldGroupType',
        Label : 'AI Analysis Results',
        Data  : [
            { $Type: 'UI.DataField', Value: sentiment,         Label: 'Customer Sentiment' },
            { $Type: 'UI.DataField', Value: customerName,      Label: 'Extracted Customer Name' },
            { $Type: 'UI.DataField', Value: product,           Label: 'Extracted Product' },
            { $Type: 'UI.DataField', Value: orderID,           Label: 'Extracted Order ID' },
            { $Type: 'UI.DataField', Value: aiConfidenceScore, Label: 'AI Confidence Score' },
            { $Type: 'UI.DataField', Value: eventStatus,       Label: 'Processing Status' }
        ]
    },

    UI.FieldGroup #Solution: {
        $Type : 'UI.FieldGroupType',
        Label : 'AI Suggested Solution',
        Data  : [
            { $Type: 'UI.DataField', Value: suggestedSolution, Label: 'Suggested Solution' }
        ]
    }
);

annotate service.Tickets with {
    title             @title: 'Title';
    description       @title: 'Description'        @UI.MultiLineText;
    status            @title: 'Status';
    priority          @title: 'Priority';
    category          @title: 'Category';
    sentiment         @title: 'Sentiment';
    customerName      @title: 'Customer Name';
    product           @title: 'Product';
    orderID           @title: 'Order ID';
    suggestedSolution @title: 'Suggested Solution' @UI.MultiLineText;
    aiConfidenceScore @title: 'AI Confidence';
    customerEmail     @title: 'Customer Email';
}
