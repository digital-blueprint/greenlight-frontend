import {createInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPGreenlightLitElement from "./dbp-greenlight-lit-element";
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {LoadingButton, Icon, MiniSpinner, InlineNotification} from '@dbp-toolkit/common';
import {classMap} from 'lit-html/directives/class-map.js';
import MicroModal from './micromodal.es';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as CheckinStyles from './styles';
import {send} from "@dbp-toolkit/common/notification";
import qrcode from "qrcode-generator";

class ShowActiveTickets extends ScopedElementsMixin(DBPGreenlightLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.activeTickets = [];
        this.activeTicketsCounter = 0;
        this.loading = false;
        this._initialFetchDone = false;
        this.locationName = 'TU Graz';
        this.identifier = '';
        this.currentTicket = {};

        this.searchHashString = '';
        this.greenPassHash = '';
        this.isSelfTest = false;
        this.hasValidProof = false;

        this.preCheck = true;


    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-loading-button': LoadingButton,
          'dbp-inline-notification': InlineNotification,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            activeTickets: { type: Array, attribute: false },
            activeTicketsCounter: { type: Number, attribute: false },
            initialTicketsLoading: { type: Boolean, attribute: false },
            loading: { type: Boolean, attribute: false },
            locationName: { type: String, attribute: false },
            identifier: { type: String, attribute: false },
            greenPassHash: { type: String, attribute: false },
            preCheck: { type: Boolean, attribute: false },
            searchHashString: { type: String, attribute: 'gp-search-hash-string' },
            searchSelfTestStringArray: { type: String, attribute: 'gp-search-self-test-string-array' },
        };
    }

    connectedCallback() {
        super.connectedCallback();
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    this._i18n.changeLanguage(this.lang);
                    break;
            }
            //console.log("######", propName);
        });

        super.update(changedProperties);
    }

    loginCallback() {
        super.loginCallback();

        this.getListOfActiveTickets();
    }

    parseActiveTickets(response) {
        let list = [];

        let numTypes = parseInt(response['hydra:totalItems']);
        if (isNaN(numTypes)) {
            numTypes = 0;
        }
        for (let i = 0; i < numTypes; i++ ) {
            list[i] = response['hydra:member'][i];
        }

        return list;
    }

    async sendDeleteTicketRequest() {
        const options = {
            method: 'DELETE',
            headers: {
                Authorization: "Bearer " + this.auth.token
            },
        };

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits/' + this.identifier, options);
    }

    async getActiveTicketsRequest() {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };
        const additionalInformation = this.hasValidProof ? 'local-proof' : '';
        console.log("---------------------", additionalInformation);

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits?additional-information=' +
            encodeURIComponent(additionalInformation), options);
    }

    async updateReferenceTicket(that) {
        let responseData = await that.getActiveTicketsRequest();
        let responseBody = await responseData.clone().json();

        if(responseData.status === 200) {
            console.log("refreshed", responseBody['hydra:member'][0].imageValidFor );
            that.referenceImage = responseBody['hydra:member'][0].image || '';
            that.error = false;
            const that_ = that;
            if (!this.setTimeoutIsSet) {
                that_.setTimeoutIsSet = true;
                setTimeout(function () {
                    that_.updateReferenceTicket(that_);
                    that_.setTimeoutIsSet = false;
                }, responseBody['hydra:member'][0].imageValidFor * 1000 + 1000 || 3000);
            }
        } else {
            that.error = true;
        }
    }

    async generateQrCode() {
        this.loading = true;

        await this.checkForValidProofLocal();
        if (this.greenPassHash !== '' && this.greenPassHash !== -1 && this.hasValidProof) {
            console.log("Generate QR Code");
            // TODO check hash valid
            let typeNumber = 0;
            let errorCorrectionLevel = 'H';
            let qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(this.greenPassHash);
            qr.make();
            this._("#qr-code-hash").innerHTML = qr.createImgTag();
        } else {
            console.log("wrong code detected");
        }
        this.loading = false;
        this.preCheck = false;

    }

    /**
     * Get a list of active tickets
     *
     * @returns {Array} list
     */
    async getListOfActiveTickets() {
        this.initialTicketsLoading = !this._initialFetchDone;
        try {
            let response = await this.getActiveTicketsRequest();
            let responseBody = await response.clone().json();
            if (responseBody !== undefined && responseBody.status !== 403) {
                this.activeTickets = this.parseActiveTickets(responseBody);
                this.activeTicketsCounter++;
            }
        } finally {
            this.initialTicketsLoading = false;
            this._initialFetchDone = true;
        }
    }

    async checkDeleteTicketResponse(response) {
        const i18n = this._i18n;

        switch(response.status) {
            case 204:
                send({
                    "summary": i18n.t('show-active-tickets.delete-ticket-success-title'),
                    "body":  i18n.t('show-active-tickets.delete-ticket-success-body', { place: this.locationName }),
                    "type": "success",
                    "timeout": 5,
                });
                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CreateTicketSuccess', 'name': this.location.name});
                this.locationName = '';
                this.identifier = '';

                break;

            default: //TODO error handling - more cases
                send({
                    "summary": i18n.t('show-active-tickets.other-error-title'),
                    "body":  i18n.t('show-active-tickets.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;
        }
    }

    // async checkRefreshTicketResponse(response) {
    //     const i18n = this._i18n;

    //     switch(response.status) {
    //         case 201:
    //             send({
    //                 "summary": i18n.t('show-active-tickets.refresh-ticket-success-title'),
    //                 "body":  i18n.t('show-active-tickets.refresh-ticket-success-body', { place: this.locationName }),
    //                 "type": "success",
    //                 "timeout": 5,
    //             });
    //             //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CreateTicketSuccess', 'name': this.location.name});
    //             this.locationName = '';
    //             this.identifier = '';

    //             break;

    //         default: //TODO error handling - more cases
    //             send({
    //                 "summary": i18n.t('show-active-tickets.other-error-title'),
    //                 "body":  i18n.t('show-active-tickets.other-error-body'),
    //                 "type": "danger",
    //                 "timeout": 5,
    //             });
    //             break;
    //     }
    // }

    showTicket(event, ticket) {
        this.generateQrCode();
        this.currentTicket = ticket;
        MicroModal.show(this._('#show-ticket-modal'), {
            disableScroll: true,
            onClose: modal => {
                this.statusText = "";
                this.loading = false;
            },
        });
    }

    // async refreshTicket(event, entry) {
    //     this.locationName = entry.place;
    //     let response = await this.sendCreateTicketRequest();
    //     await this.checkRefreshTicketResponse(response);

    //     response = await this.getActiveTicketsRequest();
    //     let responseBody = await response.json();
    //     if (responseBody !== undefined && responseBody.status !== 403) {
    //         this.activeTickets = this.parseActiveTickets(responseBody);
    //         this.activeTicketsCounter++;
    //     }
    // }

   async deleteTicket(event, entry) {
        this.identifier = entry.identifier;
        let response = await this.sendDeleteTicketRequest();
        let responseBody = await response.clone();
        await this.checkDeleteTicketResponse(responseBody);
        
        response = await this.getActiveTicketsRequest();
        responseBody = await response.clone().json();
        if (responseBody !== undefined && responseBody.status !== 403) {
            this.activeTickets = this.parseActiveTickets(responseBody);
            this.activeTicketsCounter--;
        }

    }

    closeDialog(e) {
        MicroModal.close(this._('#show-ticket-modal'));
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getNotificationCSS()}
            ${CheckinStyles.getCheckinCss()}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getModalDialogCSS()}
            
            .foto-container, .proof-container {
                width: 49%;
            }

            .foto-container img {
                width: 100%;
            }
            
            .proof-container h4 {
                margin-top: 0px;
            }
            
            .ticket {
                display: flex;
                justify-content: space-between;
                column-gap: 15px;
                row-gap: 1.5em;
                align-items: center;
                margin-bottom: 2em;
            }
            
            .tickets {
                margin-top: 2em;
            }

            .btn {
                display: flex;
                justify-content: space-between;
                column-gap: 0.5em;
            }

            .header {
                display: grid;
                align-items: center;
            }
            
            .border {
                margin-top: 2rem;
                padding-top: 2rem;
                border-top: 1px solid black;
            }

            #ticket-modal-box {
                display: flex;
                flex-direction: column;
                padding: 30px;
                max-height: 400px;
                min-height: 400px;
                min-width: 680px;
                max-width: 680px;
            }

            #ticket-modal-box .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
            }

            #ticket-modal-box .modal-header h2 {
                font-size: 1.2rem;
                padding-right: 5px;
            }

            #ticket-modal-box .modal-content {
                display: flex;
                flex-direction: row;
                column-gap: 2em;
            }

            #ticket-modal-box .modal-content label {
                display: block;
                width: 100%;
                text-align: left;
            }

           /* #ticket-modal-box .modal-content div {
                display: flex;
                flex-direction: column;
                margin-top: 33px;
            }*/

            #ticket-modal-box .modal-footer {
                padding-top: 15px;
            }

            #ticket-modal-box .modal-footer .modal-footer-btn {
                display: flex;
                justify-content: space-between;
                padding-bottom: 15px;
            }
            
            #ticket-modal-box .modal-header {
                padding: 0px;
            }

            #ticket-modal-content {
                padding: 0px;
                align-items: start;
            }

            #ticket-modal-box .modal-header h2 {
                text-align: left;
            }

            @media only screen
            and (orientation: portrait)
            and (max-width:768px) {

                .ticket {
                    display: block;
                    margin-bottom: 0;
                }

                .tickets {
                    display: block;
                }

                .header {
                    margin-bottom: 0.5rem;
                }

                #delete-btn {
                    margin-bottom: 2rem;
                }

                .btn {
                    flex-direction: column;
                    row-gap: 0.5em;
                }
                
                .loading {
                    justify-content: center;
                }
                
                #ticket-modal-box {
                    width: 100%;
                    height: 100%;
                    min-width: 100%;
                    min-height: 100%;
                    padding: 10px;
                }
                
                #ticket-modal-box .modal-content {
                    flex-direction: column;
                    justify-content: center;
                    text-align: center;
                    align-items: center;
                    row-gap: 2em;
                }
                
                .foto-container {
                    width: 60%;
                }
                
                .proof-container {
                    width: 100%;
                }
            }
        `;
    }

    render() {
        const i18n = this._i18n;

        if (this.isLoggedIn() && !this.isLoading() && !this.loading && this.preCheck) {
            this.generateQrCode();
        }

        if (this.isLoggedIn() && !this.isLoading() && !this._initialFetchDone && !this.initialTicketsLoading) {
            // this.getListOfActiveTickets();
        }
      //  this.generateQrCode();

        return html`

            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-login-message')}
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                
                <h2>${i18n.t('show-active-tickets.title')}</h2>
                <p>${i18n.t('show-active-tickets.description')}</p>
                
                <div class="border tickets ${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                    ${ this.activeTickets.map(ticket => html`
                        <div class="ticket">
                            <span class="header">
                                <strong>${this.locationName}</strong>
                                ${this.getReadableDate(ticket.validFrom, ticket.validUntil)}
                            </span>
                            <div class="btn">
                                <dbp-loading-button type="is-primary" ?disabled="${this.loading}" value="${i18n.t('show-active-tickets.show-btn-text')}" @click="${(event) => { this.showTicket(event, ticket); }}" title="${i18n.t('show-active-tickets.show-btn-text')}"></dbp-loading-button>
                                <!-- <dbp-loading-button id="refresh-btn" ?disabled="${this.loading}" value="${i18n.t('show-active-tickets.refresh-btn-text')}" @click="${(event) => { this.refreshTicket(event, ticket); }}" title="${i18n.t('show-active-tickets.refresh-btn-text')}"></dbp-loading-button>  -->
                                <dbp-loading-button id="delete-btn" ?disabled="${this.loading}" value="${i18n.t('show-active-tickets.delete-btn-text')}" @click="${(event) => { this.deleteTicket(event, ticket); }}" title="${i18n.t('show-active-tickets.delete-btn-text')}"></dbp-loading-button>
                            </div>
                        </div>
                    `)}
                    <span class="control ${classMap({hidden: this.isLoggedIn() && !this.initialTicketsLoading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                    </span>
                    
                    <div class="no-tickets ${classMap({hidden: !this.isLoggedIn() || this.initialTicketsLoading || this.activeTickets.length !== 0})}">${i18n.t('show-active-tickets.no-tickets-message')}</div>
                </div>

            </div>
            
            <div class="modal micromodal-slide" id="show-ticket-modal" aria-hidden="true">
                <div class="modal-overlay" tabindex="-2" data-micromodal-close>
                    <div class="modal-container" id="ticket-modal-box" role="dialog" aria-modal="true"
                         aria-labelledby="ticket-modal-title">
                        <header class="modal-header">
                            <h3 id="ticket-modal-title">${i18n.t('show-active-tickets.show-ticket-title')}<strong>${this.locationName}</strong></h3>
                            <button title="Close" class="modal-close" aria-label="Close modal" @click="${() => { this.closeDialog(); }}">
                                <dbp-icon title="${i18n.t('file-sink.modal-close')}" name="close" class="close-icon"></dbp-icon>
                            </button>
                        </header>
                        <main class="modal-content" id="ticket-modal-content">
                            <div class="foto-container">
                                <img src="${this.currentTicket.image || ''}" alt="Ticketfoto" />
                            </div>
                            <div class="proof-container ${classMap({hidden: !this.hasValidProof})}">
                                 <div class="notification-wrapper">
                                    <div class="g-proof-information">
                                        <div class="${classMap({hidden: this.isSelfTest || !this.hasValidProof})}">
                                            <span class="header">
                                                <h4>${i18n.t('acquire-3g-ticket.3g-proof')}</h4>
                                            </span>
                                        </div>
                                        <div class="${classMap({hidden: !this.isSelfTest || !this.hasValidProof})}">
                                            <span class="header">
                                                <h4>${i18n.t('acquire-3g-ticket.selfe-test')}</h4> 
                                                ${i18n.t('acquire-3g-ticket.selfe-test-information')}
                                            </span>
                                        </div>
                                        <div id="qr-code-hash"></div>
                                    </div>
                                    
                                </div>
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-active-tickets', ShowActiveTickets);