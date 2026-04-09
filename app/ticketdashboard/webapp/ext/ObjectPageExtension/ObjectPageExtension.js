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

    var oExtension = ControllerExtension.extend("my.support.ticketdashboard.ext.ObjectPageExtension.ObjectPageExtension", {
        override: {
            onInit: function() {
                console.log("✅ ObjectPageExtension loaded successfully");
            }
        },

        onSendReply: function() {
            console.log("✅ onSendReply called!");
            var oView = this.base.getView();
            var oContext = oView.getBindingContext();

            if (!oContext) {
                MessageBox.error("No ticket selected.");
                return;
            }

            var sTicketId = oContext.getProperty("ID");
            var sSuggestedSolution = oContext.getProperty("suggestedSolution") || "";
            var sCustomerEmail = oContext.getProperty("customerEmail") || "";
            var sCustomerName = oContext.getProperty("customerName") || "Customer";

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
                            MessageToast.show("✅ Reply sent to " + sCustomerEmail);
                        }).catch(function(oError) {
                            oDialog.setBusy(false);
                            MessageBox.error("Failed: " + (oError.message || JSON.stringify(oError)));
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

    return oExtension;
});
