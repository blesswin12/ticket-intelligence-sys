sap.ui.define([
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/TextArea",
    "sap/m/Text",
    "sap/m/VBox",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Dialog, Button, TextArea, Text, VBox, MessageToast, MessageBox) {
    "use strict";

    function _openReplyDialog(oContext) {
        var sTicketId        = oContext.getProperty("ID");
        var sSuggestedSolution = oContext.getProperty("suggestedSolution") || "";
        var sCustomerEmail   = oContext.getProperty("customerEmail") || "";

        if (!sCustomerEmail) {
            MessageBox.warning("This ticket has no customer email address. Cannot send reply.");
            return;
        }

        var oTextArea = new TextArea({
            width: "100%",
            rows: 6,
            value: sSuggestedSolution,
            placeholder: "Type your reply here..."
        });

        var oDialog = new Dialog({
            title: "Send Reply to " + sCustomerEmail,
            content: new VBox({
                items: [
                    new Text({ text: "Reply will be sent to: " + sCustomerEmail }),
                    oTextArea
                ]
            }).addStyleClass("sapUiSmallMargin"),
            beginButton: new Button({
                type: "Emphasized",
                text: "Send Email",
                press: function () {
                    var sReplyText = oTextArea.getValue();
                    if (!sReplyText.trim()) {
                        MessageBox.warning("Please enter a reply message.");
                        return;
                    }
                    oDialog.setBusy(true);

                    var oModel = oContext.getModel();
                    var oOperation = oModel.bindContext("/sendReply(...)");
                    oOperation.setParameter("ticketId", sTicketId);
                    oOperation.setParameter("replyText", sReplyText);

                    oOperation.execute().then(function () {
                        oDialog.setBusy(false);
                        oDialog.close();
                        MessageToast.show("Reply sent to " + sCustomerEmail);
                    }).catch(function (oError) {
                        oDialog.setBusy(false);
                        MessageBox.error("Failed to send: " + (oError.message || JSON.stringify(oError)));
                    });
                }
            }),
            endButton: new Button({
                text: "Cancel",
                press: function () { oDialog.close(); }
            }),
            afterClose: function () { oDialog.destroy(); }
        });

        oDialog.open();
    }

    return {
        // Called from Object Page header action
        onSendReply: function (oBindingContext /*, aSelectedContexts */) {
            console.log("CustomActions.onSendReply called", oBindingContext);
            if (!oBindingContext) {
                MessageBox.error("No ticket context available.");
                return;
            }
            _openReplyDialog(oBindingContext);
        },

        // Called from List Report table toolbar action
        onSendReplyFromList: function (oBindingContext, aSelectedContexts) {
            console.log("CustomActions.onSendReplyFromList called", aSelectedContexts);
            var aContexts = aSelectedContexts && aSelectedContexts.length ? aSelectedContexts : [];
            if (!aContexts.length) {
                MessageBox.warning("Please select a ticket first.");
                return;
            }
            _openReplyDialog(aContexts[0]);
        }
    };
});
