sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"my/support/ticketdashboard/test/integration/pages/TicketsList",
	"my/support/ticketdashboard/test/integration/pages/TicketsObjectPage"
], function (JourneyRunner, TicketsList, TicketsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('my/support/ticketdashboard') + '/test/flpSandbox.html#mysupportticketdashboard-tile',
        pages: {
			onTheTicketsList: TicketsList,
			onTheTicketsObjectPage: TicketsObjectPage
        },
        async: true
    });

    return runner;
});

