sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/TextArea",
    "sap/m/Text",
    "sap/m/VBox",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function(ControllerExtension, Dialog, Button, TextArea, Text, VBox, MessageToast, MessageBox) {
    "use strict";

    return ControllerExtension.extend("my.support.ticketdashboard.ext.ListReportExtension.ListReportExtension", {
        override: {
            onInit: function() {
                console.log("✅ ListReportExtension loaded");
                try {
                    var oExtAPI = this.base.getExtensionAPI();
                    console.log("ExtensionAPI:", JSON.stringify(Object.keys(oExtAPI)));
                    console.log("ExtensionAPI full:", oExtAPI);
                } catch(e) { console.log("ExtAPI error:", e.message); }
                var api = this.base.getExtensionAPI ? this.base.getExtensionAPI() : null;
                console.log("ExtensionAPI keys:", api ? Object.keys(api) : "no api");
            }
        },

        onSendReply: function() {
            console.log("✅ onSendReply called from List!");
            var oView = this.base.getView();
            var oTable = oView.byId("fe::table::Tickets::LineItem-innerTable");
            var aSelected = oTable ? oTable.getSelectedItems() : [];

            if (!aSelected.length) {
                MessageBox.warning("Please select a ticket first.");
                return;
            }

            var oContext = aSelected[0].getBindingContext();
            var sTicketId = oContext.getProperty("ID");
            var sSuggestedSolution = oContext.getProperty("suggestedSolution") || "";
            var sCustomerEmail = oContext.getProperty("customerEmail") || "";

            if (!sCustomerEmail) {
                MessageBox.warning("This ticket has no customer email. Cannot send reply.");
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
                    press: function() {
                        var sReplyText = oTextArea.getValue();
                        if (!sReplyText.trim()) {
                            MessageBox.warning("Please enter a reply message.");
                            return;
                        }
                        oDialog.setBusy(true);
                        var oModel = oView.getModel();
                        var oOperation = oModel.bindContext("/sendReply(...)");
                        oOperation.setParameter("ticketId", sTicketId);
                        oOperation.setParameter("replyText", sReplyText);
                        oOperation.execute().then(function() {
                            oDialog.setBusy(false);
                            oDialog.close();
                            MessageToast.show("✅ Reply sent to " + sCustomerEmail + "!");
                        }).catch(function(oError) {
                            oDialog.setBusy(false);
                            MessageBox.error("Failed: " + (oError.message || "Unknown error"));
                        });
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function() { oDialog.close(); }
                }),
                afterClose: function() { oDialog.destroy(); }
            });

            oView.addDependent(oDialog);
            oDialog.open();
        }
    });
});
