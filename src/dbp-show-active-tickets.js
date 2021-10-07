
import {css, html} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {InlineNotification} from '@dbp-toolkit/common';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as CheckinStyles from './styles';
import {send} from "@dbp-toolkit/common/notification";
import qrcode from "qrcode-generator";
import {InfoTooltip} from '@dbp-toolkit/tooltip';
import {Activity} from "./activity";
import metadata from "./dbp-show-active-tickets.metadata.json";
import DBPGreenlightTicketLitElement, {getTicketCss} from "./dbp-greenlight-ticket-lit-element";


class ShowActiveTickets extends ScopedElementsMixin(DBPGreenlightTicketLitElement) {
    constructor() {
        super();
        this.activity = new Activity(metadata);

        this.activeTickets = [];
        this.locationName = 'Ticket';
        this.currentTicket = {};
        this.greenPassHash = '';
        this.hasValidProof = false;
        this.isSelfTest = false;
        this.loadingTickets = true;
        this.preCheck = false;

    }

    static get scopedElements() {
        return {
            ...super.scopedElements,
            'dbp-inline-notification': InlineNotification,
            'dbp-info-tooltip': InfoTooltip,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            activeTickets: {type: Array, attribute: false},
            locationName: {type: String, attribute: 'preselected-option'},
            currentTicket: {type: Object, attribute: false},
            greenPassHash: {type: String, attribute: false},
            hasValidProof: {type: Boolean, attribute: false},
            isSelfTest: {type: Boolean, attribute: false},
            loadingTickets: {type: Boolean, attribute: false},
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    this._i18n.changeLanguage(this.lang);
                    break;
            }
        });
        super.update(changedProperties);
    }

    loginCallback() {
        super.loginCallback();
        this.getListOfActiveTickets();
        this.checkForValidProofLocalWrapper();
    }

    /**
     * Parse an activeTicket response and return a list
     *
     * @param response
     * @returns {Array} list
     */
    parseActiveTickets(response) {
        let list = [];

        let numTypes = parseInt(response['hydra:totalItems']);
        if (isNaN(numTypes)) {
            numTypes = 0;
        }
        for (let i = 0; i < numTypes; i++) {
            list[i] = response['hydra:member'][i];
        }

        return list;
    }

    /**
     * Sends a delete Ticket request
     *
     * @param ticketID
     */
    async sendDeleteTicketRequest(ticketID) {
        const options = {
            method: 'DELETE',
            headers: {
                Authorization: "Bearer " + this.auth.token
            },
        };

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits/' + ticketID, options);
    }

    /**
     * Gets a specific ticket
     *
     * @param ticketID
     * @returns {object} response
     */
    async getActiveTicketRequest(ticketID) {

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };

        const additionalInformation = this.hasValidProof && !this.isSelfTest ? 'local-proof' : '';

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits/' + ticketID + '?additional-information=' +
            encodeURIComponent(additionalInformation), options);
    }

    /**
     * Gets the active tickets
     *
     * @returns {object} response
     */
    async getActiveTicketsRequest() {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };
        const additionalInformation = this.hasValidProof ? 'local-proof' : '';

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits?additional-information=' +
            encodeURIComponent(additionalInformation), options);
    }

    /**
     * Updates a ticket and sets a timer for next update
     * Notifies the user if something went wrong
     *
     * @returns {boolean}
     */
    async updateTicket() {
        if (this.ticketOpen === false || this.currentTicket && Object.keys(this.currentTicket).length === 0)
            return false;

        const i18n = this._i18n;
        let responseData = await this.getActiveTicketRequest(this.currentTicket.identifier);
        let responseBody = "";
        try {
            responseBody = await responseData.clone().json();
        } catch (e) {
            this.setTimeoutIsSet = false;
            this.showReloadButton = true;
            return false;
        }

        let ret;

        switch (responseData.status) {
            case 200: // Success
                this.sendSuccessAnalyticsEvent('UpdateTicketRequest', 'Success', '');
                this.showReloadButton = false;
                this.currentTicket = responseBody;
                this.ticketImage = responseBody.image;
                this.setTimer(responseBody.imageValidFor * 1000 + 1000);
                ret = true;
                break;

            case 401:
                this.sendErrorAnalyticsEvent('UpdateTicketRequest', 'LoggedOut', this.location, responseData);
                this.getListOfActiveTickets();
                send({
                    "summary": i18n.t('show-active-tickets.logged-out-title'),
                    "body": i18n.t('show-active-tickets.logged-out-body', {place: this.locationName}),
                    "type": "warning",
                    "timeout": 5,
                });
                this.showReloadButton = false;
                this.setTimeoutIsSet = false;
                ret = false;
                break;

            case 404:
                this.sendErrorAnalyticsEvent('UpdateTicketRequest', 'NotFound', this.location, responseData);
                this.getListOfActiveTickets();
                send({
                    "summary": i18n.t('show-active-tickets.delete-ticket-notfound-title'),
                    "body": i18n.t('show-active-tickets.delete-ticket-notfound-body', {place: this.locationName}),
                    "type": "warning",
                    "timeout": 5,
                });
                this.showReloadButton = false;
                this.setTimeoutIsSet = false;
                ret = false;
                break;

            default:
                this.sendErrorAnalyticsEvent('UpdateTicketRequest', 'UnknownError', this.location, responseData);
                this.getListOfActiveTickets();
                console.log("Update ticket failed");
                this.setTimeoutIsSet = false;
                this.showReloadButton = true;
                ret = false;
                break;
        }

       return ret;
    }


    /**
     * Check if a local Proof exists wrapper
     *
     */
    async checkForValidProofLocalWrapper() {
        this.loading = true;
        this.preCheck = true;
        await this.checkForValidProofLocal();
        if (!this.greenPassHash || this.greenPassHash === -1) {
            this.hasValidProof = false;
            this.isSelfTest = false;
        }
        this.loading = false;
    }

    /**
     * Generate a QR Code at #qr-code-hash
     * if a valid local stored evidence is found
     *
     */
    async generateQrCode() {
        await this.checkForValidProofLocal();
        if (this.greenPassHash && this.greenPassHash !== -1 && this.hasValidProof) {
            let typeNumber = 0;
            let errorCorrectionLevel = 'H';
            let qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(this.greenPassHash);
            qr.make();
            let opts = {};
            opts.cellSize = 2;
            opts.margin = 2;
            opts.scalable = true;
            if (this._("#qr-code-hash"))
                this._("#qr-code-hash").innerHTML = qr.createSvgTag(opts);
        } else {
            this.hasValidProof = false;
            this.isSelfTest = false;
        }
    }

    /**
     * Generate a QR Code if a hash is avaible and valid,
     * updates the ticket and shows it in modal view
     *
     * @param {object} ticket
     */
    async showTicket(ticket) {
        this.ticketLoading = true;

        this.openTicket('ShowTicket');
        await this.generateQrCode();
        this.currentTicket = ticket;
        let success = await this.updateTicket();

        if (!success) {
            this.currentTicket = {};
        }
        this.ticketLoading = false;

    }



    /**
     * Sends a delete Ticket Request for the specific entry,
     * Checks the response and update the listview
     *
     * @param {object} ticket
     */
    async deleteTicket(ticket) {
        let response = await this.sendDeleteTicketRequest(ticket.identifier);
        let responseBody = await response.clone();
        await this.checkDeleteTicketResponse(responseBody);

        await this.getListOfActiveTickets();
    }

    /**
     * Checks the response from DeleteTicketRequest
     * and notify the user
     *
     * @param {object} response
     */
    async checkDeleteTicketResponse(response) {
        const i18n = this._i18n;
        switch (response.status) {
            case 204:
                this.sendSuccessAnalyticsEvent("DeleteTicketRequest", 'Success', "");
                send({
                    "summary": i18n.t('show-active-tickets.delete-ticket-success-title'),
                    "body": i18n.t('show-active-tickets.delete-ticket-success-body', {place: this.locationName}),
                    "type": "success",
                    "timeout": 5,
                });
                break;

            case 401:
                this.sendErrorAnalyticsEvent('DeleteTicketRequest', 'Loggedout', this.location, response);
                send({
                    "summary": i18n.t('show-active-tickets.logged-out-title'),
                    "body": i18n.t('show-active-tickets.logged-out-body'),
                    "type": "warning",
                    "timeout": 5,
                });
                break;

            case 404:
                this.sendErrorAnalyticsEvent('DeleteTicketRequest', 'NotFound', this.location, response);
                send({
                    "summary": i18n.t('show-active-tickets.delete-ticket-notfound-title'),
                    "body": i18n.t('show-active-tickets.delete-ticket-notfound-body', {place: this.locationName}),
                    "type": "warning",
                    "timeout": 5,
                });
                break;

            default:
                this.sendErrorAnalyticsEvent('DeleteTicketRequest', 'UnknownError', this.location, response);
                send({
                    "summary": i18n.t('show-active-tickets.other-error-title'),
                    "body": i18n.t('show-active-tickets.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;
        }
        this.locationName = '';
    }

    /**
     * Get a list of active tickets and checks the response of the request
     *
     */
    async getListOfActiveTickets() {

        let response = await this.getActiveTicketsRequest();
        await this.checkActiveTicketsRequest(response);
    }

    /**
     * Checks the response from getActiveTicketsRequest
     * updates the ticket list
     * and notify the user if something went wrong
     *
     * @param {object} response
     */
    async checkActiveTicketsRequest(response) {
        let responseBody = await response.clone().json();
        if (responseBody !== undefined && response.status === 200) {
            this.activeTickets = this.parseActiveTickets(responseBody);
        } else {
            // else it failed, but we want to fail soft
            console.log("Update tickets failed");
        }
        this.loadingTickets = false;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getActivityCSS()}
            ${commonStyles.getNotificationCSS()}
            ${CheckinStyles.getCheckinCss()}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getModalDialogCSS()}
            ${commonStyles.getLinkCss()}
            ${getTicketCss()}

            #qr-code-hash svg {
                display: block;
                width: 80%;
                margin: auto;
            }

            .green-pass-evidence {
                line-height: 30px;
            }

            .qr-code-wrapper.self-test-qr {
                margin: 20px auto;
                width: 60%;
            }

            .qr-code-wrapper  {
                width: 100%;
            }

            .red {
                color: var(--dbp-danger-bg-color);
            }

            .green {
                color: var(--dbp-success-bg-color);
            }

            .warning {
                color: var(--dbp-info-bg-color);
            }

            .flex {
                display: flex;
            }

            .flex-center {
                justify-content: center;
            }

            .hidden {
                display: none;
            }


            @media only screen
            and (orientation: landscape)
            and (max-width: 768px) {
                #qr-code-wrapper {
                    width: 80%;
                }
            }

            @media only screen
            and (orientation: portrait)
            and (max-width: 768px) {



                

                #qr-code-hash svg {
                    width: 100%;
                }

                .new-ticket-button {
                    width: 100%;
                    display: block;
                    margin: auto;
                    box-sizing: border-box;
                }

            
            }
        `;
    }


    render() {
        const i18n = this._i18n;

        const validTill = i18n.t('valid-till')
            + i18n.t('date-time', {
                clock: this.person.validUntil ? this.formatValidUntilTime(this.person.validUntil) : '',
                date: this.person.validUntil ? this.formatValidUntilDate(this.person.validUntil) : ''
            })
            + ". "
            + i18n.t('validity-tooltip', {place: this.locationName})
            + " "
            + i18n.t('validity-tooltip-ticket-text');

        const permissions = !this.isLoggedIn() || this.isLoading() || !this.hasPermissions();

        const ticketList = html`
            ${this.activeTickets.map(ticket => html`
                <div class="ticket">
                    <span class="header">
                        <slot name="place">
                            <h3>${i18n.t('entry-ticket')}: ${this.locationName}</h3>
                        </slot>
                        <span class="header ${classMap({hidden: !this.hasValidProof})}">
                            <span>
                                <b>${i18n.t('show-active-tickets.status')}<span class="green">${i18n.t('show-active-tickets.status-active')}</span></b>
                            </span>
                            <span class="${classMap({hidden: this.isSelfTest || this.isInternalTest})}">
                                <b>${i18n.t('show-active-tickets.3-g-evidence')}: <span class="green">${i18n.t('show-active-tickets.3-g-evidence-green-pass-valid')}</span></b>
                                <dbp-info-tooltip class="tooltip" text-content="${validTill}" interactive></dbp-info-tooltip>
                            </span>
                            <span class="${classMap({hidden: !this.isSelfTest})}">
                                <b>${i18n.t('show-active-tickets.3-g-evidence')}: <span class="warning">${i18n.t('show-active-tickets.3-g-evidence-selftest')}</span></b>
                            </span>
                            <span class="flex ${classMap({hidden: !this.isInternalTest})}">
                                <slot name="internal-test-valid">
                                    <b>
                                        ${i18n.t('show-active-tickets.3-g-evidence')}:&nbsp
                                        <span class="green">
                                            ${i18n.t('show-active-tickets.3-g-evidence-internal-test')}
                                        </span>
                                    </b>
                                </slot>
                                <dbp-info-tooltip class="tooltip" text-content="${validTill}" interactive></dbp-info-tooltip>
                            </span>
                        </span>
                        <span class="header ${classMap({hidden: this.hasValidProof})}">
                            <b>${i18n.t('show-active-tickets.status')}<span class="red">${i18n.t('show-active-tickets.status-inactive')}</span></b>
                            <b>${i18n.t('show-active-tickets.3-g-evidence')}: <span class="red">${i18n.t('show-active-tickets.3-g-evidence-invalid')}</span></b>
                            <span>
                                <slot name="3-g-evidence-invalid-text"> <!-- TODO Use this slot and add a link to faq-->
                                    ${i18n.t('show-active-tickets.3-g-evidence-invalid-text')}
                                    ${i18n.t('show-active-tickets.3-g-evidence-maximize-saving')}
                                </slot>
                            </span>
                        </span>
                    </span>
                    <div class="btn">
                        <dbp-loading-button class="${classMap({hidden: !this.hasValidProof})}"
                                            type="is-primary"
                                            @click="${() => {this.showTicket(ticket);}}"
                                            title="${i18n.t('show-active-tickets.show-btn-text')}">
                            ${i18n.t('show-active-tickets.show-btn-text')}
                        </dbp-loading-button>
                        <a class="${classMap({hidden: this.hasValidProof})}" href="acquire-3g-ticket">
                            <button class="button new-ticket-button" title="${i18n.t('show-active-tickets.new-ticket')}">${i18n.t('show-active-tickets.new-ticket')}</button>
                        </a>
                        <dbp-loading-button id="delete-btn"
                                            @click="${() => {this.deleteTicket(ticket);}}"
                                            title="${i18n.t('delete-btn-text')}">
                            ${i18n.t('delete-btn-text')}
                        </dbp-loading-button>
                    </div>
                </div>
            `)}
        `;

        const additionalInformation = html`
        <div class="information-container ${classMap({hidden: this.hasValidProof || this.ticketLoading})}">
                                        <div class="${classMap({hidden: this.hasValidProof})}">
                                            <span>
                                                <h4>${i18n.t('show-active-tickets.no-3g-evidence')}</h4>
                                            </span>
                                            <slot name="greenlight-reference">
                                                <p>${i18n.t('show-active-tickets.no-evidence')}</p>
                                            </slot>
                                        </div>
                                    </div>

                                    <div class="proof-container ${classMap({hidden: !this.hasValidProof || this.ticketLoading})}">
                                        <div class="green-pass-evidence ${classMap({hidden: this.isSelfTest || !this.hasValidProof})}">
                                            <span>
                                                <h4>${i18n.t('show-active-tickets.3-g-evidence-greenpass')}</h4>
                                            </span>
                                        </div>
                                        <div class="${classMap({hidden: !this.isSelfTest || !this.hasValidProof})}">
                                            <span>
                                                <h4>${i18n.t('show-active-tickets.self-test-found')}</h4>
                                                ${i18n.t('show-active-tickets.self-test-information')}
                                                <a class="int-link-external" title="${i18n.t('show-active-tickets.self-test')}" target="_blank" rel="noopener" href="${this.greenPassHash}">${i18n.t('show-active-tickets.self-test-link')}</a>
                                            </span>
                                        </div>
                                        <div class="qr-code-wrapper ${classMap({'self-test-qr': this.isSelfTest})}">
                                            <div id="qr-code-hash"></div>
                                        </div>
                                        <div class="${classMap({hidden: !this.isSelfTest || !this.hasValidProof})}">
                                            <slot name="greenlight-reference-invalid">
                                                ${i18n.t('show-active-tickets.invalid-evidence')}
                                            </slot>
                                        </div>
                                    </div>

        `;

        const ticketUI = this.getTicketUI(permissions, ticketList, additionalInformation);


        return html`

            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-login-message')}
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="notification is-danger ${classMap({hidden: this.hasPermissions() || !this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-permission-message')}
            </div>
            ${ticketUI}
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-active-tickets', ShowActiveTickets);