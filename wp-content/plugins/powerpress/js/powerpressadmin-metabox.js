(function(window) {
// ==============================================================================
//
//                                  EPISODE LOCATIONS
//
// ===============================================================================
/**
 * Location Managment system for Podcast2.0 Tag:
 * documentation: https://podcasting2.org/docs/podcast-namespace/tags/location
 * Tag: <podcast:location>
 * Main Content: Human Readable Location (Address)
 *      - rel: (recommended) The rel attribute can contain one of the following possible values:
 *          "subject" (default) - The location refers to what/where the content is about.
 *          "creator" - The location refers to where the content was recorded or produced.
 *      - geo: (recommended) A latitude and longitude in geoURI form, following RFC5870 (i.e. “geo:30.2672,97.7431”).
 *      - osm: (recommended) The OpenStreetMap identifier of this place. Made by taking the first character of the OSM object type 
 *          -> (Node, Way, Relation), followed by the ID. (i.e. “R113314”)
 *      - country: (recommended) A two-letter code for the country, following ISO 3166-1 alpha-2 
 */
function initLocationManager(feedSlug) {
    LocationManager.init(feedSlug);
}

const LocationManager = {
    lastApiCall: 0,
    API_RATE_LIMIT_MS: 1100,
    feedSlugs: new Map(),

    getFeedSlug(feedSlug, containerElement) {
        if (!this.feedSlugs.has(feedSlug)) {
            const slug = {
                feedSlug: feedSlug,
                container: containerElement,
                tableContainer: null,
                _tbody: null,
                addressBook: new Set(),
            };

            this.feedSlugs.set(feedSlug, slug);
        }
        return this.feedSlugs.get(feedSlug);
    },

    /**
     * Main initializer
     * -> Init content containers
     * -> Init event handlers
     */
    init(feedSlug) {
        const container = document.getElementById(`location-container-${feedSlug}`);
        if (!container) return;

        const slug = this.getFeedSlug(feedSlug, container);
        slug.tableContainer = container.querySelector(`#location-table-container-${feedSlug}`);
        slug._tbody = slug.tableContainer?.querySelector('tbody') || null;

        container.addEventListener('click', (e) => this.onClick(e, feedSlug));

        slug._tbody?.querySelectorAll('tr[data-location-id]').forEach(tr => {
            const addr = tr.querySelector('input[name*="[address]"]')?.value?.trim();
            if (addr) {
                tr.dataset.addressKey = addr;
                slug.addressBook.add(addr);
            }
        });

        // Form 'Enter' Handling
        const formContainer = container.querySelector(`#location-form-container-${feedSlug}`);
        if (formContainer) {
            formContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.target.matches('input') || e.target.matches('select'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.addLocation(feedSlug);
                    return false;
                }
            });
        }

        this.updateTableDisplay(feedSlug);
    },


    /**
     * Sets up event handling within the location section
     * @param {Event} e - click event 
     * @returns when the element is not of this root container
     */
    onClick(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const el = e.target.closest('[data-action]');
        if (!el || !slug.container.contains(el)) return;

        switch(el.dataset.action) {
            case 'add-location':
                e.preventDefault();
                this.addLocation(feedSlug);
                break;
            case 'remove-location':
                e.preventDefault();
                this.removeLocation(el, feedSlug);
                break;
        }
    },

    /**
     * Async function to add new location
     * -> clean input whitespace
     * -> attempt to search api, bail early if custom location is checked
     * @returns on error, missing input / data
     */
    async addLocation(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const addressInput = slug.container.querySelector(`#location-search-input-${feedSlug}`);
        const countrySelect = slug.container.querySelector(`#location-search-country-${feedSlug}`);
        const customLocation = slug.container.querySelector('input[data-field="custom-location"]');
        
        // check for content input container
        if (!addressInput) {
            showError('Address input not found', `location-error-${feedSlug}`);
            return;
        }
        
        // clean input for search
        const address = cleanHTMLTags(addressInput.value);
        const country = countrySelect?.value || '';
        
        if (!address) {
            showError('Address is required', `location-error-${feedSlug}`);
            return;
        } 
        
        // disable add button to prevent multiple clicks on the same input
        const addButton = slug.container.querySelector('[data-action="add-location"]');
        if (addButton) {
            addButton.disabled = true;
            addButton.style.opacity = 0.5;
        }

        showLoading(`location-loading-${feedSlug}`);
        hideError(`location-error-${feedSlug}`);

        try {
            // check if custom location checkbox is checked to bypass API validation
            let locationData;
            if (customLocation?.checked) {
                locationData = {
                    address: address,
                    country: '',
                    geo: '',
                    osm: ''
                };
            } else {
                // api validation
                locationData = await this.validateLocationAddress(address, country);
            }

            // fail if the address is already in our addressBook
            if (slug.addressBook.has(locationData.address.trim())) {            
                showError('Address already exists.', `location-error-${feedSlug}`);
                return;
            }
            // Fill data with api returns
            const newLocation = {
                id: this.getNextId(feedSlug),
                rel: '1',
                address: locationData.address,
                country: customLocation?.checked ? '' : country || '',
                geo: locationData.geo || '',
                osm: locationData.osm || ''
            };
            // failed searches still added as custom locations ( may not need now that the checkbox is added (?) )
            if (!locationData.geo) {
                this.showSuccess(`Added "${locationData.address}" as a custom location.`, feedSlug);
            }
                
            // update state of form and table
            this.addLocationRow(newLocation, feedSlug);
            slug.addressBook.add(locationData.address);
            this.clearForm(feedSlug);
            this.updateTableDisplay(feedSlug);
        } catch (error) {
            showError("Failed to add location: " + error.message, `location-error-${feedSlug}`);
        } finally {
            hideLoading(`location-loading-${feedSlug}`);
            if (addButton) {
                // re-enable add button 
                addButton.disabled = false;
                addButton.style.opacity = 1;
            }
        }
    },


    /**
     * Adds new location to table using template
     * @param {object} locationData - locationData to add to table {id, rel, address, country, geo, osm}
     * @returns 
     */
    addLocationRow(locationData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const rowTemplate = slug.container.querySelector(`#location-row-template-${feedSlug}`);
        const node = rowTemplate.content.firstElementChild.cloneNode(true);
        const id = locationData.id;

        // setup new template clone w proper id
        node.dataset.locationId = id;
        node.querySelector('[data-action="remove-location"]').dataset.locationId = id;

        const relSelect = node.querySelector('[data-cell="rel"] select');
        if (relSelect) relSelect.value = locationData.rel;

        const addressDiv = node.querySelector('[data-cell="address"] div');
        if (addressDiv) addressDiv.textContent = locationData.address || 'Unknown location';

        const geoCode = node.querySelector('[data-cell="geo"] code');
        if (geoCode) geoCode.textContent = locationData.geo ? '✓' : '×';

        const osmCode = node.querySelector('[data-cell="osm"] code');
        if (osmCode) osmCode.textContent = locationData.osm ? '✓' : '×';
        
        // Setup template with proper id
        node.querySelectorAll('input, select').forEach(input => {
            if (input.name && input.name.includes('__ID__')) {
                input.name = input.name.replace('__ID__', id);
            }
        });

        // set hidden input with data to save
        node.querySelectorAll('input[type="hidden"]').forEach(input => {
            const field = input.dataset.field;

            if (field === 'address') 
                input.value = locationData.address || '';
            else if (field === 'country') 
                input.value = locationData.country || '';
            else if (field === 'geo') 
                input.value = locationData.geo || '';
            else if (field === 'osm') 
                input.value = locationData.osm || '';
        });
    
        slug._tbody.appendChild(node);
    },


    /**
     * Location removal wrapper
     * -> removes row
     * -> updates display
     * @param {HTML Element} button - remove button
     */
    removeLocation(button, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const row = button.closest('tr[data-location-id]');
        if (row) {
            const address = row.querySelector('[data-cell="address"]')?.textContent?.trim() || row.querySelector('input[name*="[address]"]')?.value?.trim();

            if (address) slug.addressBook.delete(address);
            row.remove();
            this.updateTableDisplay(feedSlug);
        }
    },


    /**
     * Checks if table is empty, changes display to show empty table state
     */
    updateTableDisplay(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const table = slug.container.querySelector('.table-wrap');
        const tbody = slug._tbody || slug.tableContainer?.querySelector('tbody');
        const msg = slug.container.querySelector(`#location-table-message-${feedSlug}`);

        if (tbody.querySelectorAll('tr[data-location-id]').length === 0) {
            if (table) table.style.display = 'none';
            if (msg) msg.style.display = 'block'; 
        } else {
            if (table) table.style.display = 'block';
            if (msg) msg.style.display = 'none'; 
        }
    },


    /**
     * checks for highest available id to prevent overlap
     * @returns next available id
     */
    getNextId(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;
        
        // grab existing rows
        const existingLocations = slug.container.querySelectorAll(`tr[data-location-id]`);
        let maxId = 0;
        // find highest data-location-id
        existingLocations.forEach(location => {
            const id = parseInt(location.dataset.locationId);
            if (id > maxId) maxId = id;
        });
        return maxId + 1;
    },


    /**
     * Check internal counter to make sure we dont over-request from api
     * @returns true if we've waited long enough
     */
    canMakeApiCall() {
        const now = Date.now();
        if (now - this.lastApiCall < this.API_RATE_LIMIT_MS) {
            return false;
        }
        this.lastApiCall = now;
        return true;
    },

    /**
     * Try to get location from nominatim / open street map (OSM)
     * @param {string} address - address input string
     * @param {string} country - country selection
     * @returns newLocation object {address, geo, osm, country}
     */
    async validateLocationAddress(address, country = '') {
        if (!this.canMakeApiCall()) {
            throw new Error('Please wait a moment before trying again.');
        }
        // Remove html 
        address = cleanHTMLTags(address);
        if (!address || address.trim() === '') {
            throw new Error('Address is required for validation');
        }

        // init so we always have a return regardless of api request failure
        const newLocation = {
            address: address,
            geo: '',
            osm: '',
            country: country
        };

        try {
            // request 1 result from OSM endpoint
            const searchQuery = country ? `${address}, ${country}` : address;
            const nominatimURL = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
                format: 'json',
                q: searchQuery,
                addressdetails: '1',
                limit: '1'
            }).toString()}`;

            const response = await fetch(nominatimURL);

            if (response.ok) {
                const data = await response.json();

                if (data.length > 0) {
                    // update newLocation object
                    const location = data[0];
                    newLocation.address = location.display_name;
                    newLocation.geo = `geo:${location.lat},${location.lon}`;
                    // if no country was originally provided we can extract from api data
                    if (!country && location.address && location.address.country) {
                        newLocation.country = location.address.country;
                    }

                    if (location.osm_id) {
                        const osmPrefix = location.osm_type === 'way' ? 'W' : location.osm_type === 'relation' ? 'R' : 'N';
                        newLocation.osm = `${osmPrefix}${location.osm_id}`;
                    }
                }
            }
        } catch (error) {
            console.warn('Location API failed:', error.message);
        }
        // we return newLocation object regardless of api failure
        return newLocation;
    },

    /**
     * update error display to show a success message to user, clears itself after 3 seconds
     * @param {string} message 
     */
    showSuccess(message, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const errorDiv = slug.container.querySelector(`#location-error-${feedSlug}`);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.style.backgroundColor = '#d1edff';
            errorDiv.style.borderColor = '#bee5eb';
            errorDiv.style.color = '#0c5460';

            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 3000);
        }
    },

    /**
     * clear form inputs, reset loading and error state
     */
    clearForm(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const searchInput = slug.container.querySelector(`[data-purpose="search-input"]`);
        if (searchInput) searchInput.value = '';

        hideLoading(`location-loading-${feedSlug}`);
        hideError(`location-error-${feedSlug}`);
    }
};



// =====================================================================================================================
//
//                                  EPISODE CREDIT MANAGER
//
// =====================================================================================================================
function initCreditsManager(feedSlug) {
    CreditsManager.init(feedSlug);
}

/**
 * Credit Managment system for Podcast2.0 Tag:
 * documentation: https://podcasting2.org/docs/podcast-namespace/tags/person
 * Tag: <podcast:person>
 * Main Content: Name
 *       Suported Attributes:
 *          - role: (optional) Used to identify what role the person serves on the show or episode.
 *                             This should be a reference to an official role within the Podcast Taxonomy Project list (see below).
 *                             - If role is missing then “host” is assumed. -
 *          - img: (optional) This is the url of a picture or avatar of the person.
 *          - href: (optional) The url to a relevant resource of information about the person, such as a homepage or third-party profile platform.
 */
const CreditsManager = {
    feedSlugs: new Map(),

    getFeedSlug(feedSlug, containerElement) {
        if (!this.feedSlugs.has(feedSlug)) {
            const slug = {
                feedSlug: feedSlug,
                container: containerElement,
                tableContainer: null,
                _tbody: null,
                isEditMode: false
            };

            this.feedSlugs.set(feedSlug, slug);
        }
        return this.feedSlugs.get(feedSlug);
    },

    /**
     * Initializer
     * -> setup credits containers
     * -> setup event handling on the container
     * -> update display
     */
    init(feedSlug) {
        const container = document.getElementById(`credit-role-container-${feedSlug}`);
        if (!container) return;

        const slug = this.getFeedSlug(feedSlug, container);

        slug.tableContainer = container.querySelector(`#credit-table-container-${feedSlug}`);
        slug._tbody = slug.tableContainer?.querySelector('tbody') || null;

        container.addEventListener('click', (e) => this.onClick(e, feedSlug));
        container.addEventListener('change', (e) => this.onChange(e, feedSlug));
        
        // Form 'Enter' Handling
        const formContainer = container.querySelector(`#credit-form-container-${feedSlug}`);
        if (formContainer) {
            formContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.target.matches('input') || e.target.matches('select'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.addCredit(feedSlug);
                    return false;
                }
            });
        }

        this.updateTableDisplay(feedSlug);
    },


    /**
     * Click event handler for the Credit Manager container
     * @param {event} e - Click event
     * @returns early failure when the element that clicked wasnt from this container
     */
    onClick(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const el = e.target.closest('[data-action]');
        if(!el || !slug.container.contains(el)) return;

        switch(el.dataset.action) {
            case 'add-credit':
                e.preventDefault();
                this.addCredit(feedSlug);
                break;
            case 'remove-credit':
                e.preventDefault();
                this.removeCredit(el, feedSlug);
                break;
            case 'edit-credit':
                e.preventDefault();
                this.editCredit(el, feedSlug);
                break;
        }       
    },


    /**
     * Change handler for Credit Manager
     * @param {Event} e - change event
     * @returns 
     */
    onChange(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const el = e.target.closest('[data-action]');
        if (!el || !slug.container.contains(el)) return;

        switch(el.dataset.action) {
            case 'inherit-credits':
                e.preventDefault();
                this.toggleInheritedCreditsPreview(feedSlug);
                break;
        }
    },

    /**
     * Handler for editing an existing tag
     * @param {HTML Element} button - Edit button 
     * @returns when row doenst exist
     */
    editCredit(button, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const row = button.closest('tr[data-credit-id]');
        if (!row) return;

        const existingData = this.extractCreditDataFromRow(row);
        slug.isEditMode = true;
        this.updateFormEdit(existingData, feedSlug);

        row.remove();
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Extracts exisiting tag information from row
     * @param {HTML Object} row - row of existing tag
     * @returns {Object} tag object information
     */
    extractCreditDataFromRow(row) {
        const creditId = parseInt(row.dataset.creditId);

        return  {
            id: creditId,
            name: row.querySelector(`input[name*="[name]"]`)?.value,
            role: row.querySelector(`input[name*="[role]"]`)?.value || '',
            person_url: row.querySelector(`input[name*="[person_url]"]`)?.value || '',
            link_url: row.querySelector(`input[name*="[link_url]"]`)?.value || '',
        };
    },

    /**
     * Populates form with the existingData
     * @param {Object} existingData - txt tag object from row
     */
    updateFormEdit(existingData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        slug.container.querySelector(`#credit-name-input-${feedSlug}`).value = existingData.name || '';
        slug.container.querySelector(`#credit-role-select-${feedSlug}`).value = existingData.role || '';
        slug.container.querySelector(`#credit-person-url-input-${feedSlug}`).value = existingData.person_url || '';
        slug.container.querySelector(`#credit-link-url-input-${feedSlug}`).value = existingData.link_url || '';
    },


    /**
     * Add credit to collection on click then call render
     * -> Grab Form information
     * -> Clean Input
     * -> add Credit to Manager's Credits array and re-render
     */
    addCredit(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        // Grab Form Inputs
        const nameInput = slug.container.querySelector(`#credit-name-input-${feedSlug}`);
        const roleSelect = slug.container.querySelector(`#credit-role-select-${feedSlug}`);
        const personUrlInput = slug.container.querySelector(`#credit-person-url-input-${feedSlug}`);
        const linkUrlInput = slug.container.querySelector(`#credit-link-url-input-${feedSlug}`);

        if (!nameInput || !roleSelect) {
            showError('Form inputs not found', `credit-error-${feedSlug}`);
            return;
        }

        // clean input
        const name = cleanHTMLTags(nameInput.value);
        const role = cleanHTMLTags(roleSelect.value);
        const personUrl = cleanHTMLTags(personUrlInput.value) || '' ;
        const linkUrl = cleanHTMLTags(linkUrlInput.value) || '';

        // verify required field
        if (!name) {
            showError('Name is required', `credit-error-${feedSlug}`);
            return;
        }

        // setup new credit
        const newCredit = {
            id: this.getNextId(feedSlug),
            name: name,
            role: role,
            personUrl: personUrl,
            linkUrl: linkUrl
        };

        // add to credits array + reset + rerender
        this.addCreditRow(newCredit, feedSlug);
        this.clearForm(feedSlug);
        if (slug.isEditMode) slug.isEditMode = false;
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Append new row into table container
     */
    addCreditRow(creditData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        // setup template
        const rowTemplate = slug.container.querySelector(`#credit-row-template-${feedSlug}`);
        const node = rowTemplate.content.firstElementChild.cloneNode(true);
        const id = creditData.id;

        node.dataset.creditId = id;
        node.querySelector('[data-action="remove-credit"]').dataset.creditId = id;

        node.querySelector('[data-cell="name"]').textContent = creditData.name;
        node.querySelector('[data-cell="role"]').textContent = creditData.role;

        // setup urls for display
        renderSafeLink(node.querySelector('[data-cell="personUrl"]'), creditData.personUrl);
        renderSafeLink(node.querySelector('[data-cell="linkUrl"]'), creditData.linkUrl);

        // update hidden inputs for saving
        node.querySelectorAll('input[type="hidden"]').forEach(input => {
            input.name = input.name.replace('__ID__', id);
            if (/name]$/.test(input.name))
                input.value = creditData.name;
            else if (/role]$/.test(input.name)) 
                input.value = creditData.role;
            else if (/person_url]$/.test(input.name))
                input.value = creditData.personUrl || '';
            else if (/link_url]$/.test(input.name))
                input.value = creditData.linkUrl || '';
        });

        slug._tbody.appendChild(node);
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Remove credit row on click
     * @param e - click event
     */
    removeCredit(button, feedSlug) {
        const creditRow = button.closest('tr[data-credit-id]');
        if (!creditRow) return;
        creditRow.remove();
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Parses the highest current id and increments on that to avoid overlap
     * @returns {number}
     */
    getNextId(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return 1;

        const existingCredits = slug.container.querySelectorAll(`tr[data-credit-id]`);
        let maxId = 0;

        existingCredits.forEach(credit => {
            const id = parseInt(credit.dataset.creditId);
            if (id > maxId) maxId = id;
        });

        return maxId + 1;
    },


    /**
     * Show status message based on the length of rows
     *      -- Can be extended to display messages / status updates if required -- 
     */
    updateTableDisplay(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const table = slug.tableContainer || slug.container.querySelector(`#credit-table-container-${feedSlug}`);
        const tbody = slug._tbody || slug.tableContainer?.querySelector('tbody');
        const msg = slug.container.querySelector(`#credit-table-message-${feedSlug}`);

        // if table is empty show empty table message
        if (tbody.querySelectorAll('tr[data-credit-id]').length === 0) {
            if (table) table.style.display = 'none';
            if (msg) msg.style.display = 'block';
        } else {
            if (msg) msg.style.display = 'none';
            if (table) table.style.display = 'block';
        } 
    },


    /**
     * Toggle Visibility of Show Level Credits based on checkbox state
     * @returns if the dom elements dont exist
     */
    toggleInheritedCreditsPreview(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const inheritCheckbox = slug.container.querySelector(`#inherit-channel-credits-${feedSlug}`);
        const previewDiv = slug.container.querySelector(`#inherited-credits-preview-${feedSlug}`);
        
        if (!inheritCheckbox || !previewDiv) return;
        
        // Show/hide based on checkbox state
        previewDiv.style.display = inheritCheckbox.checked ? 'block' : 'none';
    },


    /**
     * Clear data from input form
     */
    clearForm(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const nameInput = slug.container.querySelector(`#credit-name-input-${feedSlug}`);
        const roleSelect = slug.container.querySelector(`#credit-role-select-${feedSlug}`);
        const personUrlInput = slug.container.querySelector(`#credit-person-url-input-${feedSlug}`);
        const linkUrlInput = slug.container.querySelector(`#credit-link-url-input-${feedSlug}`);

        if (nameInput) nameInput.value = '';
        if (roleSelect) roleSelect.value = 'Guest';
        if (personUrlInput) personUrlInput.value = '';
        if (linkUrlInput) linkUrlInput.value = '';

        hideError(`credit-error-${feedSlug}`);
    },
};







// =====================================================================================================================
//
//                                  EPISODE VALUE RECIPIENT
//
// =====================================================================================================================
function initValueRecipientManager(feedSlug) {
    ValueRecipientsManager.init(feedSlug);
}

/**
 * Value Recipient Managment system for Podcast2.0 Tag:
 * documentation: https://podcasting2.org/docs/podcast-namespace/tags/value-recipient
 * Tag: <podcast:valueRecipient>
 * Supported Attributes:
 *     - name: (recommended) A free-form string that designates who or what this recipient is.
 *     - customKey: (optional) The name of a custom record key to send along with the payment.
 *     - customValue: (optional) A custom value to pass along with the payment. This is considered the value that belongs to the customKey.
 *     - type: (required) A slug that represents the type of receiving address that will receive the payment.
 *     - address: (required) This denotes the receiving address of the payee.
 *     - split: (required) The number of shares of the payment this recipient will receive.
 *     - fee: (optional) If this attribute is not specified, it is assumed to be false.
 */
const ValueRecipientsManager = {
    feedSlugs: new Map(),

    lastApiCall: 0,
    API_RATE_LIMIT_MS: 1000,

    getFeedSlug(feedSlug, containerElement) {
        if (!this.feedSlugs.has(feedSlug)) {
            const slug = {
                feedSlug: feedSlug,
                container: containerElement,
                tableContainer: null,
                _tbody: null,
                pubkeySet: new Set(),
                currentRecipientData: null
            };

            this.feedSlugs.set(feedSlug, slug);
        }
        return this.feedSlugs.get(feedSlug);
    },


    /**
     * Initializer for unique feedSlugs
     * -> bind event handlers
     * -> render pre-loaded recipients
     */
    init(feedSlug) {
        const container = document.getElementById(`value-recipient-container-${feedSlug}`)
        if (!container) return;

        const slug = this.getFeedSlug(feedSlug, container);

        slug.tableContainer = container.querySelector(`#value-recipient-table-container-${feedSlug}`);
        slug._tbody = slug.tableContainer?.querySelector('tbody') || null;

        // event handlers
        container.addEventListener('click', (e) => this.onClick(e, feedSlug));
        container.addEventListener('input', (e) => this.onInput(e, feedSlug));
        container.addEventListener('change', (e) => this.onChange(e, feedSlug));
       
        // Form 'Enter' HandlingformContainer
        const initializerContainer = container.querySelector(`#lightning-address-form-${feedSlug}`);
        const confirmationContainer = container.querySelector(`#recipient-confirmation-form-${feedSlug}`);
        if (initializerContainer) {
            initializerContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.target.matches('input') || e.target.matches('select'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.checkLightningAddress(feedSlug);
                    return false;
                }
            });
        } 
        if (confirmationContainer) {
            confirmationContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.target.matches('input') || e.target.matches('select'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.confirmRecipient(feedSlug);
                    return false;
                }
            });
        }

        this.hydratePubkeySet(feedSlug);
        this.updateSplitTotalIndicators(feedSlug);
        this.updateTableDisplay(feedSlug);
        this.toggleInheritedRecipientsPreview(feedSlug);
    },


    /**
     * Click handler for Value Recipients Container
     */
    onClick(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const el = e.target.closest('[data-action]');
        if (!el || !slug.container.contains(el)) return;

        switch(el.dataset.action) {
            case 'check-lightning':
                e.preventDefault();
                this.checkLightningAddress(feedSlug);
                break;
            case 'confirm-recipient':
                e.preventDefault();
                this.confirmRecipient(feedSlug);
                break;
            case 'cancel-recipient':
                e.preventDefault();
                this.cancelRecipientForm(feedSlug);
                break;
            case 'remove-recipient':
                e.preventDefault();
                this.removeRecipient(el, feedSlug);
                break;
        }
    },


    /**
     * Event handler for inputs in Value Recipients Container
     * @param {Event} e - input event  
     * @returns 
     */
    onInput(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        // Handle Split Changes on table
        if (e.target.matches('input[data-field="split"]')) {
            const row = e.target.closest('tr[data-recipient-id]');
            if (!row) return;

            const hiddenSplit = row.querySelector('input[type="hidden"][name$="split]"]');
            if (hiddenSplit) hiddenSplit.value = e.target.value || '';
            this.updateSplitTotalIndicators(feedSlug);
        }
        if (e.target.matches('input[data-field="split-inherited"]')) {
            const row = e.target.closest('tr[data-origin="inherited"]');
            if (!row) return;

            const hiddenSplit = row.querySelector('input[type="hidden"][name$="[split]"]');
            if (hiddenSplit) hiddenSplit.value = e.target.value || '';
            this.updateSplitTotalIndicators(feedSlug);
        }
    },


    /**
     * Change handler for Credit Manager
     * @param {Event} e - change event
     * @returns 
     */
    onChange(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const el = e.target.closest('[data-action]');
        if (!el || !slug.container.contains(el)) return;

        switch(el.dataset.action) {
            case 'inherit-recipients':
                this.toggleInheritedRecipientsPreview(feedSlug);
                break;
        }
    },


    /**
     * Toggle Visibility of Show Level Credits based on checkbox state
     * @returns if the dom elements dont exist
     */
    toggleInheritedRecipientsPreview(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const inheritCheckbox = slug.container.querySelector(`#inherit-channel-recipients-${feedSlug}`);
        const previewDiv = slug.container.querySelector(`#inherited-recipients-preview-${feedSlug}`);
        if (!inheritCheckbox || !previewDiv) return;
        
        // Show/hide based on checkbox state
        const show = inheritCheckbox.checked;
        previewDiv.style.display = show ? 'block' : 'none';

        const inputs = previewDiv.querySelectorAll('input');
        inputs.forEach(input => {
            if (show) {
                input.disabled = false;
                input.removeAttribute('disabled');
            } else {
                input.disabled = true;
                input.setAttribute('disabled', '');
            }
        });

        this.updateSplitTotalIndicators(feedSlug);
    },




    /**
     * Preload pubkeySet to avoid duplicate valueRecipients
     */
    hydratePubkeySet(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const inputs = slug.container.querySelectorAll('input[type="hidden"][name$="pubkey]"]');
        inputs.forEach(input => {
            const val  = (input.value || '').trim().toLowerCase();
            if (val) slug.pubkeySet.add(val);
        });
    },


    /**
     * Creates reciepient form based on detected service,
     * will always allow you to populate the table regardless of search success
     * -> Extract Lightning address
     * -> Check if we support the end point of the provided address
     * -> If supported request from api, else manual entry
     * -> Generate form
     * @param e
     */
    async checkLightningAddress(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        // Extract + Clean Lightning Address to search
        const lightningInput = slug.container.querySelector(`#lightning-address-input-${feedSlug}`);
        if (!lightningInput) return;

        const lightningAddress = cleanHTMLTags(lightningInput.value.trim());
        if (!lightningAddress) {
            showError('Lightning address or name is required', `value-recipient-error-${feedSlug}`);
            return;
        }

        // Display loading status
        showLoading(`value-recipient-loading-${feedSlug}`);
        hideError(`value-recipient-error-${feedSlug}`);

        try {
            // check if we support the endpoint
            const detection = this.detectWalletService(lightningAddress);

            // MANUAL FALLBACK FOR ANY UNSUPPORTED ENDPOINT
            if (!detection.supported) {
                showInfo(`${detection.message} Adding as manual entry.`, `value-recipient-error-${feedSlug}`);
            }

            // attempt to request lightning address data from detected api endpoint
            // manual will be bypassed in validation but we can add an if to skip validation for manual if we wanted
            const walletData = await this.validateWalletAddress(detection.service, lightningAddress);

            // Create new recipient object
            const newRecipient = {
                id: this.getNextId(feedSlug),
                lightningAddress,
                pubkey: walletData.pubkey,
                customKey: walletData.customKey,
                customValue: walletData.customValue,
                split: 0,
                fee: false
            };

            slug.currentRecipientData = newRecipient;
            this.showConfirmationForm(slug.currentRecipientData, feedSlug);
        } catch (error) {
            hideLoading(`value-recipient-loading-${feedSlug}`);
            showError(error.message, `value-recipient-error-${feedSlug}`);
        }
    },


    /**
     * Handler when user submits detailed form
     */
    confirmRecipient(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        // grab form data
        const formData = this.extractFormData(feedSlug);
        if (!formData) return;

        // check pubkeySet for duplicate
        const key = (formData.pubkey || '').trim().toLowerCase();
        if (key && slug.pubkeySet.has(key)) {
            showError('That pubkey is already in the list. If you can\'t find it, check the channel recipients table.', `value-recipient-error-${feedSlug}`);
            return;
        }

        // add new row, add pubkey to set
        this.addRecipientRow(formData, feedSlug);
        if (key) slug.pubkeySet.add(key);

        // update form + table display
        this.showLightningAddressForm(feedSlug);
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Handler for cancelling detailed form input, resets back to lightning input form
     */
    cancelRecipientForm(feedSlug) {
        this.showLightningAddressForm(feedSlug);
    },


    /**
     * Attempts to pull data from form inputs
     */
    extractFormData(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        if (!slug.currentRecipientData) return null;
        
        // clean input fields of extra spaces
        const pubkey = cleanHTMLTags(slug.container.querySelector(`#confirm-pubkey-${feedSlug}`)?.value);
        const customKey = cleanHTMLTags(slug.container.querySelector(`#confirm-custom-key-${feedSlug}`)?.value) || '';
        const customValue = cleanHTMLTags(slug.container.querySelector(`#confirm-custom-value-${feedSlug}`)?.value) || '';
        const split = parseFloat(cleanHTMLTags(slug.container.querySelector(`#confirm-split-${feedSlug}`)?.value)) || 0;
        const fee = !!slug.container.querySelector(`#confirm-fee-${feedSlug}`)?.checked;

        if (!pubkey) {
            showError('Pubkey required', `value-recipient-error-${feedSlug}`);
            return null;
        }

        return {
            ...slug.currentRecipientData,
            pubkey,
            customKey,
            customValue,
            split,
            fee
        };
    },

    /**
     * Setsup new Row from recipientData and inserts into table and hidden
     * inputs to ensure data is saved
     * @param {Object} recipientData 
     */
    addRecipientRow(recipientData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        // Grab Template and Copy
        const rowTemplate = slug.container.querySelector(`#recipient-row-template-${feedSlug}`);
        const node = rowTemplate.content.firstElementChild.cloneNode(true);
        const id = recipientData.id;

        // setup new row data
        node.dataset.recipientId = id;
        node.querySelector('[data-action="remove-recipient"]').dataset.recipientId = id;

        // setup data for each cell / data piece
        node.querySelector('[data-cell="lightningAddress"]').textContent = recipientData.lightningAddress;
        node.querySelector('[data-cell="pubkey"]').textContent = recipientData.pubkey ? recipientData.pubkey.substring(0, 20) + '...' : '-';
        node.querySelector('[data-cell="customKey"]').textContent = recipientData.customKey || '-';
        node.querySelector('[data-cell="customValue"]').textContent = recipientData.customValue || '-';
        node.querySelector('[data-cell="split"] input').value = recipientData.split || 0;
        node.querySelector('[data-cell="fee"]').textContent = recipientData.fee ? 'Yes' : 'No';

        // update hidden inputs with form data
        node.querySelectorAll('input[type=hidden]').forEach(input => {
            input.name = input.name.replace('__ID__', id);
            if (/lightning]$/.test(input.name)) input.value = recipientData.lightningAddress;
            else if (/custom_key]$/.test(input.name)) input.value = recipientData.customKey || '';
            else if (/custom_value]$/.test(input.name)) input.value = recipientData.customValue || '';
            else if (/pubkey]$/.test(input.name)) input.value = recipientData.pubkey || '';
            else if (/split]$/.test(input.name)) {
                input.value = recipientData.split || '';
                const tableInput = input.closest('tr').querySelector('[data-field="split"]');
                if (tableInput) tableInput.value = recipientData.split || 0;
            }
            else if (/fee]$/.test(input.name)) input.value = recipientData.fee ? 'true' : 'false';
        });

        slug._tbody.appendChild(node);
        this.updateSplitTotalIndicators(feedSlug);
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Remove container by detected Id
     * @param e
     */
    removeRecipient(button, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const recipientContainer = button.closest('tr[data-recipient-id]');
        if (recipientContainer) {
            // remove pubkey from set
            const pkInput = recipientContainer.querySelector('[name$="pubkey]"]');
            const pk = (pkInput?.value || '').trim().toLowerCase();
            if (pk) slug.pubkeySet?.delete(pk);

            console.log('Removing container:', recipientContainer);
            console.log('Hidden inputs in container:', recipientContainer.querySelectorAll('input[type="hidden"]'));

            recipientContainer.remove();
            this.updateSplitTotalIndicators(feedSlug);
            this.updateTableDisplay(feedSlug);
        }
    },


    /**
     * Safely parse a new highest value so we have no accidental overlap
     * @returns {number}
     */
    getNextId(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return 1;

        const existingRecipients = slug.container.querySelectorAll(`tr[data-recipient-id]`);
        let maxId = 0;

        existingRecipients.forEach(recipient => {
            const id = parseInt(recipient.dataset.recipientId);
            if (id > maxId) maxId = id;
        });

        return maxId + 1;
    },


    /**
     * Detect wallet service based on input value
     * -> Validation Checks for Name vs Lightning Address
     * -> If name, return manual
     * -> If lightning, search supported endpoints in WALLET_SERVICES
     * -> If unsupported, return with an additional message
     * @param lightningAddress
     * @returns {
     *          {service: string, supported: boolean}
     *              typical return when supported or manual
     *          {service: string, supported: boolean, message: string}
     *              only returns message for unsupported + detected endpoints
     *          }
     */
    detectWalletService(lightningAddress) {
        const WALLET_SERVICES = {
            manual: { name: 'manual', displayName: 'Manual Entry' },
            getalby: {
                name: 'alby',
                displayName: 'Alby',
                endpoint: 'https://getalby.com/.well-known/keysend/',
                domains: ['getalby.com', 'alby.com']
            },
            fountain: {
                name: 'fountain',
                displayName: 'Fountain',
                endpoint: 'https://api.fountain.fm/v1/lnurlp/',
                domains: ['fountain.fm']
            }
        };

        // No @ means its a name, return manual
        if (!lightningAddress || !lightningAddress.includes('@')) {
            return {service: 'manual', supported: true};
        }
        // Provided an input like @johnnyDoe, return manual
        const domain = lightningAddress.split('@')[1]?.toLowerCase();
        if (!domain) {
            return {service: 'manual', supported: true};
        }
        // Search existing wallet services for the specified domain
        for (const [serviceKey, serviceConfig] of Object.entries(WALLET_SERVICES)) {
            if (serviceConfig.domains && serviceConfig.domains.includes(domain)) {
                return {service: serviceKey, supported: true};
            }
        }

        // failed to match to supported endpoint, return manual with message
        return {
            service: 'manual',
            supported: false,
            message: `We don't support @${domain} yet, but if you message support, we can get right on that! For now, you can add this manually.`
        };
    },

    /**
     * Called when supported service detected, attempts to get user information from specified domain
     * -> Validation checks, auto-return empty object for manual entries
     * -> Extract username and search based on serviceType
     * ->
     * @param serviceType
     * @param lightningAddress
     * @returns {Promise<{pubkey: (string|*), customKey: (*|string), customValue: (*|string)}|{pubkey: string, customKey: string, customValue: string}>}
     */
    async validateWalletAddress(serviceType, lightningAddress) { 
        // Bypass and instant return for manual
        if (serviceType === 'manual') {
            return { pubkey: '', customKey: '', customValue: '' };
        }

        // Check if we can even request api data, removes risk of spamming
        if (!this.canMakeApiCall()) {
            throw new Error('Please wait a moment before trying again.');
        }

        // Check valid username
        const username = lightningAddress.substring(0, lightningAddress.indexOf('@'));
        if (!username) {
            throw new Error('Invalid address format');
        }


        // SUPPORTED API ENDPOINTS
        const WALLET_SERVICES = {
            getalby: {
                endpoint: 'https://getalby.com/.well-known/keysend/'
            },
            fountain: {
                endpoint: 'https://api.fountain.fm/v1/lnurlp/'
            }
        };


        // some last sanity checks
        const service = WALLET_SERVICES[serviceType];
        if (!service) {
            throw new Error(`Unknown service type: ${serviceType}`);
        }

        // Attempt to get data from specified service
        // returns empty data object on failure
        try {
            let url, response, data;

            // alby endpoint
            if (serviceType === 'getalby') {
                url = `${service.endpoint}${encodeURIComponent(username)}`;
                response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Alby wallet not found for ${username}`);
                }
                data = await response.json();
                return {
                    pubkey: data.pubkey || '',
                    customKey: data.customData?.[0]?.customKey || '',
                    customValue: data.customData?.[0]?.customValue || ''
                };
            } 

            // fountain endpoint
            else if (serviceType === 'fountain') {
                url = `${service.endpoint}${encodeURIComponent(username)}/keysend`;
                response = await fetch(url);
                data = await response.json();
                if (!response.ok || data.status === 'Not Found') {
                    throw new Error(`Fountain wallet not found for ${username}`);
                }
                return {
                    pubkey: data.pubkey || '',
                    customKey: data.customData?.[0]?.customKey || '',
                    customValue: data.customData?.[0]?.customValue || ''
                };
            }

            // default empty obj
            return {pubkey: '', customKey: '', customValue: ''};
        } catch (error) {
            throw new Error(`Wallet validation failed: ${error.message}`);
        }
    },


    /**
     * Compare current time to last API call time, weak rate limiter
     * @returns {boolean}
     */
    canMakeApiCall() {
        const now = Date.now();
        if (now - this.lastApiCall < this.API_RATE_LIMIT_MS) {
            return false;
        }
        this.lastApiCall = now;
        return true;
    },


    /**
     * changes table appearance depending on if the table is empty or not
     */
    updateTableDisplay(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const table = slug.tableContainer || slug.container.querySelector(`#value-recipient-table-container-${feedSlug}`);
        const tbody = slug._tbody || slug.tableContainer?.querySelector('tbody');
        const msg = slug.container.querySelector(`#value-recipient-table-message-${feedSlug}`);

        // if table empty, display empty table message and hide table frame
        if (tbody.querySelectorAll('tr[data-recipient-id]').length === 0) {
            if (table) table.style.display = 'none';
            if (msg) msg.style.display = 'block';
        } else {
            if (msg) msg.style.display = 'none';
            if (table) table.style.display = 'block';
        }
    },


    /**
     * Updates UI split data based on existing splits and fees
     * -> Extract Split data, separate fees
     * -> Display total
     * -> Render Status styling based on totals
     */
    updateSplitTotalIndicators(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        // change selector based on status of inherit checkbox
        const inheritCheckbox = !!slug.container.querySelector(`#inherit-channel-recipients-${feedSlug}`)?.checked;
        const selector = inheritCheckbox ? `tr[data-recipient-id], tr[data-origin="inherited"]`: `tr[data-recipient-id]`; 

        const recipientForms = slug.container.querySelectorAll(selector);
        let feeTotal = 0;
        let regularTotal = 0;
        // Extract Split data, separate fees
        recipientForms.forEach(form => {
            const splitInput = form.querySelector('input[data-field="split"]') || form.querySelector('input[data-field="split-inherited"]');
            const split = parseFloat(splitInput?.value) || 0;

            const isFee = !!form.querySelector('input[type="hidden"][name*="[fee]"]')?.checked;

            if (isFee) {
                feeTotal += split;
            } else {
                regularTotal += split;
            }
        });

        // display calculated total
        slug.container.querySelectorAll('.total-percentage').forEach(span => {
            span.textContent = `Regular: ${regularTotal.toFixed(1)}% | Fees: ${feeTotal.toFixed(1)}%`;
        });

        // Render status based on input amount
        slug.container.querySelectorAll('.total-status').forEach(span => {
            // remove old status class
            span.className = span.className.replace(/\b(status-good|status-over|status-under)\b/g, '').trim();

            if (regularTotal === 100) {
                span.textContent = '✓ Good to go!';
            } else if (regularTotal > 100) {
                span.textContent = '⚠ Over 100%';
            } else if (regularTotal > 0) {
                span.textContent = '⚠ Under 100%';
            } else {
                span.textContent = '';
            }
        });
    },


    /**
     * Clear input form after verification
     */
    clearForm(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const lightningInput = slug.container.querySelector(`#lightning-address-input-${feedSlug}`);
        if (lightningInput) lightningInput.value = '';
        hideError(`value-recipient-error-${feedSlug}`);
        hideLoading(`value-recipient-loading-${feedSlug}`);
    },


    /**
     * Handler to display pre-form content, allows user to start by entering a lightning url
     */
    showLightningAddressForm(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return slug;

        slug.container.querySelector(`#lightning-address-form-${feedSlug}`).style.display = 'block';
        slug.container.querySelector(`#recipient-confirmation-form-${feedSlug}`).style.display = 'none';
        this.clearForm(feedSlug);
        hideError(`value-recipient-error-${feedSlug}`);
        hideLoading(`value-recipient-loading-${feedSlug}`);
        slug.currentRecipientData = null;
    }, 


    /**
     * Opens secondary form with potentially prepopulated data based on the endpoint
     * @param {Object} recipientData - data returned from api if vaildated, otherwise empty recipient object
     */
    showConfirmationForm(recipientData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        // set values in new form based on the data recieved
        slug.container.querySelector(`#confirm-lightning-address-${feedSlug}`).value = recipientData.lightningAddress;
        slug.container.querySelector(`#confirm-pubkey-${feedSlug}`).value = recipientData.pubkey || '';
        slug.container.querySelector(`#confirm-custom-value-${feedSlug}`).value = recipientData.customValue || '';
        slug.container.querySelector(`#confirm-custom-key-${feedSlug}`).value = recipientData.customKey || '';
        slug.container.querySelector(`#confirm-split-${feedSlug}`).value = recipientData.split || 0;
        slug.container.querySelector(`#confirm-fee-${feedSlug}`).checked = !!recipientData.fee;

        slug.container.querySelector(`#lightning-address-form-${feedSlug}`).style.display = 'none';
        slug.container.querySelector(`#recipient-confirmation-form-${feedSlug}`).style.display = 'block';
        hideError(`value-recipient-error-${feedSlug}`);
        hideLoading(`value-recipient-loading-${feedSlug}`);
    }
};





// ===============================================================================================
//
//                              EPISODE SOUNDBITES MANAGER
//
// ===============================================================================================
function initSoundbitesManager(feedslug) {
    SoundbitesManager.init(feedslug);
}

/**
 * Soundbite Managment system for Podcast2.0 Tag:
 * documentation: https://podcasting2.org/docs/podcast-namespace/tags/soundbite
 * Tag: <podcast:soundbite>
 * Main Content: Title for soundbite (free-form string 128chars or less)
 *       Suported Attributes:
 *          - startTime (required): The time where the soundbite begins
 *          - duration (required): How long is the soundbite (recommended between 15 and 120 seconds)
 */
const SoundbitesManager = {
    feedSlugs: new Map(),

    getFeedSlug(feedSlug, containerElement) {
        if (!this.feedSlugs.get(feedSlug)) {
            const slug = {
                feedSlug: feedSlug,
                container: containerElement,
                tableContainer: null,
                _tbody: null,
                isEditMode: false
            };

            this.feedSlugs.set(feedSlug, slug);
        }
        return this.feedSlugs.get(feedSlug);
    },

    /**
     * Initializer
     * -> Setup event handlers
     * -> Render pre-loaded soundbites from hidden containers
     * -> setup input form and display table
     */
    init(feedSlug) {
        const container = document.getElementById(`soundbite-container-${feedSlug}`)
        if (!container) return;
        
        const slug = this.getFeedSlug(feedSlug, container);

        slug.tableContainer = container.querySelector(`#soundbite-table-container-${feedSlug}`);
        slug._tbody = slug.tableContainer?.querySelector('tbody') || null;
        
        container.addEventListener('click', (e) => this.onClick(e, feedSlug));

        // Form 'Enter' Handling
        const formContainer = container.querySelector(`#soundbite-form-container-${feedSlug}`);
        if (formContainer) {
            formContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.target.matches('input') || e.target.matches('select'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.addSoundbite(feedSlug);
                    return false;
                }
            });
        }

        this.updateTableDisplay(feedSlug);
    },

    
    /**
     * Click event handler for the soundbite container
     * @param {event} e - click event handler 
     * @returns when the element clicked is not of this container
     */
    onClick(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const el = e.target.closest('[data-action]');
        if (!el || !slug.container.contains(el)) return;

        switch(el.dataset.action) {
            case 'add-soundbite':
                e.preventDefault();
                this.addSoundbite(feedSlug);
                break;
            case 'remove-soundbite':
                e.preventDefault();
                this.removeSoundbite(el, feedSlug);
                break;
            case 'edit-soundbite':
                e.preventDefault();
                this.editSoundbite(el, feedSlug);
                break;
        }
    },


    /**
     * Initiates editing process for soundbdite abd updates table view
     * @param {HTML element} button - edit button clicked
     * @returns when no row found
     */
    editSoundbite(button, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const row = button.closest('tr[data-soundbite-id]');
        if (!row) return;

        const existingData = this.extractSoundbiteDataFromRow(row);
        slug.isEditMode = true;
        this.updateFormEdit(existingData, feedSlug);

        row.remove();
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Extract soundbite data from row in table
     * @param {HTML element} row - row to extract data from 
     * @returns soundbite object - {id, start, duration, title}
     */
    extractSoundbiteDataFromRow(row) {
        const soundbiteId = parseInt(row.dataset.soundbiteId);

        return  {
            id: soundbiteId,
            start: row.querySelector(`input[name$="start]"]`)?.value || '',
            duration: row.querySelector(`input[name$="duration]"]`)?.value || '',
            title: row.querySelector(`input[name$="title]"]`)?.value || ''
        };
    },


    /**
     * Modifies input with data to edit
     * @param {Object} existingData - soundbite object {id, start, duration, title}
     */
    updateFormEdit(existingData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const startStr = this.secondsToTimeStr(existingData.start);
        const durationStr = this.secondsToTimeStr(existingData.duration);

        slug.container.querySelector(`#soundbite-start-input-${feedSlug}`).value = startStr;
        slug.container.querySelector(`#soundbite-duration-input-${feedSlug}`).value = durationStr;
        slug.container.querySelector(`#soundbite-title-input-${feedSlug}`).value = existingData.title || '';
    },


    /**
     * Converts raw seconds -> hh:mm:ss time format
     * @param {int|string} seconds - seconds input value, can convert both string and int 
     * @returns 
     */
    secondsToTimeStr(seconds) {
        if (typeof seconds === 'string' && seconds.includes(':')) {
            const [h='0', m='0', s='0'] = seconds.split(':');
            const hh = String(parseInt(h, 10) || 0).padStart(2, '0');
            const mm = String(parseInt(m, 10) || 0).padStart(2, '0');
            const ss = String(parseInt(s, 10) || 0).padStart(2, '0');
            return `${hh}:${mm}:${ss}`;
        }
        const secs = Math.max(0, parseInt(seconds, 10) || 0);
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const ss = String(s).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    },


    /**
     * Regex based time validation and value extract
     * @param {string} timeStr 
     * @returns 
     */
    validateTime(timeStr) {
        const timeRegex = /^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/;

        if (timeStr === "00:00:00") return false;

        return timeRegex.test(timeStr);
    },


    /**
     * Add soundbite on click
     */
    addSoundbite(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        // Grab and validate inputs
        const startInput = slug.container.querySelector(`#soundbite-start-input-${feedSlug}`);
        const durationInput = slug.container.querySelector(`#soundbite-duration-input-${feedSlug}`);
        const titleInput = slug.container.querySelector(`#soundbite-title-input-${feedSlug}`);

        if (!titleInput || !startInput || !durationInput) {
            showError('Form inputs not found', `soundbite-error-${feedSlug}`);
            return;
        }

        // Extract + clean form data 
        const startTimeStr = cleanHTMLTags(startInput.value) || '';
        const durationStr = cleanHTMLTags(durationInput.value) || '';
        const title = cleanHTMLTags(titleInput.value) || '';

        const startTimeValid = this.validateTime(startTimeStr);
        const durationValid = this.validateTime(durationStr);
        
        if (startTimeValid === false && durationValid === false) {
            showError('Start Time and Duration are required', `soundbite-error-${feedSlug}`);
            return;
        }

        if (startTimeValid === false) {
            showError('Start Time is required', `soundbite-error-${feedSlug}`);
            return;
        }

        if (durationValid === false) {
            showError('Duration is required', `soundbite-error-${feedSlug}`);
            return;
        }


        // prep new soundbite object
        const soundbiteData = {
            id: this.getNextId(feedSlug),
            startTime: startTimeStr,
            duration: durationStr,
            title: title
        };


        this.addSoundbiteRow(soundbiteData, feedSlug);
        this.clearForm(feedSlug);
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Setup for new row, checks if table was rendered by pre-load
     * cache _tbody so we dont check everytime after first render
     * @param {object} soundbiteData 
     */
    addSoundbiteRow(soundbiteData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;
        if (!slug._tbody) return;

        const rowTemplate = slug.container.querySelector(`#soundbite-row-template-${feedSlug}`);
        const node = rowTemplate.content.firstElementChild.cloneNode(true);
        const id = soundbiteData.id;

        node.dataset.soundbiteId = id;
        node.querySelector('[data-action="remove-soundbite"]').dataset.soundbiteId = id;

        node.querySelector('[data-cell="title"]').textContent = soundbiteData.title;
        node.querySelector('[data-cell="startTime"]').textContent = soundbiteData.startTime;
        node.querySelector('[data-cell="duration"]').textContent = soundbiteData.duration;

        node.querySelectorAll('input[type="hidden"]').forEach(input => {
            input.name = input.name.replace('__ID__', id);
            if (/title]$/.test(input.name)) input.value = soundbiteData.title;
            else if (/start]$/.test(input.name)) input.value = soundbiteData.startTime;
            else if (/duration]$/.test(input.name)) input.value = soundbiteData.duration;
        });

        slug._tbody.appendChild(node);
    },


    /**
     * Remove soundbite on click
     * @param e
     */
    removeSoundbite(button, feedSlug) {
        const soundbiteRow= button.closest('tr[data-soundbite-id]');
        if (soundbiteRow) {
            soundbiteRow.remove();
            this.updateTableDisplay(feedSlug);
        }
    },


    /**
     * Grab next higest id to avoid overlap
     * @returns {number}
     */
    getNextId(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const existingSoundbites = slug.container.querySelectorAll(`[data-soundbite-id]`);
        let maxId = 0;

        existingSoundbites.forEach(soundbite => {
            const id = parseInt(soundbite.dataset.soundbiteId);
            if (id > maxId) maxId = id;
        });

        return maxId + 1;
    },


    /**
     * Clear soundbite input form
     */
    clearForm(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        slug.container.querySelector(`#soundbite-start-input-${feedSlug}`).value = '00:00:00';
        slug.container.querySelector(`#soundbite-duration-input-${feedSlug}`).value = '00:00:00';
        slug.container.querySelector(`#soundbite-title-input-${feedSlug}`).value = '';
        hideError(`soundbite-error-${feedSlug}`);
    },


    /**
     * Update table display to show empty message or existing rows depending on state
     */
    updateTableDisplay(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const table = slug.tableContainer || slug.container.querySelector(`#soundbite-table-container-${feedSlug}`);
        const tbody = slug._tbody || slug.tableContainer?.querySelector('tbody');
        const msg = slug.container.querySelector(`#soundbite-table-message-${feedSlug}`);

        if (tbody.querySelectorAll('tr[data-soundbite-id]').length === 0) {
            if (table) table.style.display = 'none';
            if (msg) msg.style.display = 'block';
        } else {
            if (table) table.style.display = 'block';
            if (msg) msg.style.display = 'none';
        }
    }
};





// =================================================================================
//
//                                  EPISODE SOCIAL INTERACT
//
// =================================================================================
function initSocialInteractManager(feedSlug) {
    SocialInteractManager.init(feedSlug);
}

/**
 * Social Interact Managment system for Podcast2.0 Tag:
 * documentation: https://podcasting2.org/docs/podcast-namespace/tags/social-interact
 * Tag: <podcast:socialInteract>
 *       Suported Attributes:
 *          protocol: (required) The protocol in use for interacting with the comment root post.
 *          uri: (required) The uri/url of root post comment.
 *          accountId: (recommended) The account id (on the commenting platform) of the account that created this root post.
 *          accountUrl: (optional) The public url (on the commenting platform) of the account that created this root post.
 *          priority: (optional) When multiple socialInteract tags are present, this integer gives order of priority. A lower number means higher priority.
 */
const SocialInteractManager = {
    feedSlugs: new Map(),

    getFeedSlug(feedSlug, containerElement) {
        if (!this.feedSlugs.has(feedSlug)) {
            const slug = {
                feedSlug: feedSlug,
                container: containerElement,
                formContainer: null,
                tableContainer: null,
                _tbody: null,
                currentInteractData: null
            };
            this.feedSlugs.set(feedSlug, slug);
        }
        return this.feedSlugs.get(feedSlug);
    },


    /**
     * Initializer
     */
    init(feedSlug) {
        const container = document.getElementById(`social-interact-container-${feedSlug}`);
        if (!container) return;

        const slug = this.getFeedSlug(feedSlug, container);

        slug.formContainer = slug.container.querySelector(`#social-interact-form-container-${feedSlug}`);
        slug.tableContainer = slug.container.querySelector(`#social-interact-table-container-${feedSlug}`);
        slug._tbody = slug.tableContainer?.querySelector('tbody') || null;

        container.addEventListener('click', (e) => this.onClick(e, feedSlug));
        container.addEventListener('change', (e) => this.onChange(e, feedSlug));

        // Form 'Enter' Handling
        const formContainer = container.querySelector(`#social-interact-form-container-${feedSlug}`);
        if (formContainer) {
            formContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.target.matches('input') || e.target.matches('select'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.checkSocialInteractUri(feedSlug);
                    return false;
                }
            });
        }

        this.updateSectionDisabledState(feedSlug);
        this.updateUriDisabledState(feedSlug);
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Section click handler
     */
    onClick(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const el = e.target.closest('[data-action]');
        if (!el || !slug.container.contains(el)) return;

        switch(el.dataset.action) {
            case 'check-uri':
                e.preventDefault();
                this.checkSocialInteractUri(feedSlug);
                break;
            case 'confirm-manual-protocol':
                e.preventDefault();
                this.confirmManualProtocol(feedSlug);
                break;
            case 'remove-social-interact':
                e.preventDefault();
                this.removeSocialInteract(el, feedSlug);
                break;
        }
    },


    /**
     * Section Change event
     * @param {Event} e 
     * @returns 
     */
    onChange(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        if (e.target.matches('select[data-field="protocol"]')) {
            this.updateUriDisabledState(feedSlug);
            return;
        }

        if (e.target.id === `disable-episode-comments-${feedSlug}`) {
            this.updateSectionDisabledState(feedSlug);
        }
    },

    /**
     * Form transition function, attempts to detect root post then extract account information
     * @returns when no uri is provided
     */
    checkSocialInteractUri(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const uriInput = slug.container.querySelector(`#social-interact-uri-input-${feedSlug}`);
        const uri = uriInput?.value?.trim();

        if (!uri) {
            showError('URI is required', `social-interact-error-${feedSlug}`);
            return;
        }

        showLoading(`social-interact-loading-${feedSlug}`);
        hideError(`social-interact-error-${feedSlug}`);

        try {
            // Auto-detect and extract data using new patterns
            const protocol = this.checkUri(uri);

            if (protocol === 'disabled' || !protocol) {
                hideLoading(`social-interact-loading-${feedSlug}`);
                this.showProtocolSelector(feedSlug);
                return;
            }

            const usernameData = this.extractUsername(cleanHTMLTags(uri), protocol);
            const accountId = this.buildAccountId(usernameData, protocol);
            const accountUrl = this.buildAccountUrl(usernameData, protocol);

            const interactData = {
                id: this.getNextId(feedSlug),
                uri: uri,
                protocol: protocol,
                account_id: accountId,
                accountUrl: accountUrl,
                priority: 1
            };

            this.addSocialInteractRow(interactData, feedSlug);
            this.clearForm(feedSlug);
            this.updateTableDisplay(feedSlug);
            hideLoading(`social-interact-loading-${feedSlug}`);
        } catch (error) {
            hideLoading(`social-interact-loading-${feedSlug}`);
            showError(error.message, `social-interact-error-${feedSlug}`);
        }
    },


    /**
     * populates form information to be saved in hidden inputs and on table display
     * via cloning template
     * @param {Object} formData - social interact object 
     * @returns when required dom elements dont exist
     */
    addSocialInteractRow(formData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const rowTemplate = slug.container.querySelector(`#social-interact-row-template-${feedSlug}`);
        const node = rowTemplate.content.firstElementChild.cloneNode(true);
        const id = formData.id;

        node.dataset.socialInteractId = id;
        node.querySelector('[data-action="remove-social-interact"]').dataset.socialInteractId = id;
        renderSafeLink(node.querySelector('[data-field="uri-display"]'), formData.uri);


        // Set Values
        const protocolSelect = node.querySelector('[data-cell="protocol"] select');
        if (protocolSelect) protocolSelect.value = formData.protocol;

        const accountIdInput = node.querySelector('[data-cell="accountId"] input');
        if (accountIdInput) accountIdInput.value = formData.account_id || '';

        const accountUrlInput = node.querySelector('[data-cell="accountUrl"] input');
        if (accountUrlInput) accountUrlInput.value = formData.accountUrl || '';

        const priorityInput = node.querySelector('[data-cell="priority"] input');
        if (priorityInput) priorityInput.value = formData.priority || 1;

        // update and id
        node.querySelectorAll('input, select').forEach(input => {
            if (input.name && input.name.includes('__ID__')) {
                input.name = input.name.replace('__ID__', id);
            }

            if (input.dataset.socialInteractId !== undefined) {
                input.dataset.socialInteractId = id;
            }
        });

        // update hidden input field
        const hiddenUriInput = node.querySelector('input[type="hidden"][name*="[uri]"]');
        if (hiddenUriInput) hiddenUriInput.value = formData.uri;

        slug._tbody.appendChild(node);
        this.updateUriDisabledState(feedSlug);
        this.updateTableDisplay(feedSlug);
    },

    /**
     * Display protocol select field when auto-detection fails
     */
    showProtocolSelector(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const manualProtocolDiv = slug.container.querySelector(`#social-interact-manual-protocol-${feedSlug}`);
        const protocolSelect = slug.container.querySelector(`#manual-protocol-select-${feedSlug}`);

        if (manualProtocolDiv) {
            manualProtocolDiv.style.display = 'block';
        }
        if (protocolSelect) {
            protocolSelect.value = '';
        }
    },


    confirmManualProtocol(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const uriInput = slug.container.querySelector(`#social-interact-uri-input-${feedSlug}`);
        const protocolSelect = slug.container.querySelector(`#manual-protocol-select-${feedSlug}`);

        const uri = uriInput?.value?.trim();
        const protocol = protocolSelect?.value;

        if (!protocol) {
            showError('Please select a protocol', `social-interact-error-${feedSlug}`);
            return;
        }

        const id = this.getNextId(feedSlug);

        const interact_data = {
            id: id,
            uri: uri,
            protocol: protocol,
            account_id: '',
            accountUrl: '',
            priority: id
        };

        this.addSocialInteractRow(interact_data, feedSlug);
        this.clearForm(feedSlug);
        this.updateTableDisplay(feedSlug);

        const manualProtocolDiv = slug.container.querySelector(`#social-interact-manual-protocol-${feedSlug}`);
        if (manualProtocolDiv) {
            manualProtocolDiv.style.display = 'none';
        }
    },


    /**
     * Remove social interact field on click entry
     * -> Get Target ID from remove button data atribute value
     * @param e
     */
    removeSocialInteract(button, feedSlug) {
        const row = button.closest('tr[data-social-interact-id]');
        if (row) {
            row.remove();
            this.updateTableDisplay(feedSlug);
        }
    },


    /**
     * Robust pattern matching for the existing podcast-namespace for social interact
     * @param {string} url 
     * @returns 
     */
    checkUri(url) {
        const patterns = {
            activitypub: [
                // @user@instance.x
                /^@?[A-Za-z0-9_]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?::\d+)?$/i,
                
                // https://host/@user[/statusId]
                /^(?:https?:\/\/)?[^\/]+\/@[^@\/\s]+(?:@[^\/\s]+)?(?:\/\d+)?(?:[/?#].*)?$/i,
                
                // https://host/users/user[/statuses/id] 
                /^(?:https?:\/\/)?[^\/]+\/users\/[^\/]+(?:\/statuses\/\d+)?(?:[/?#].*)?$/i,
                
                // https://host/path/@user/postid
                /^(?:https?:\/\/)?[^\/]+\/[^\/]*\/@[^\/\s]+(?:\/\w+)?(?:[/?#].*)?$/i,
                
                // ActivityPub
                /^(?:https?:\/\/)?[^\/]+\.[a-z]{2,}\/@[^\/\s]+/i,
            ],
            twitter: [
                /^(?:https?:\/\/)?(?:x\.com|twitter\.com)\/[^\/]+\/status\/\d+(?:[/?#].*)?$/i,
            ],
            atproto: [
                // Bluesky web links with handle: https://bsky.app/profile/<handle>/post/<tid>
                /^(?:https?:\/\/)?bsky\.app\/profile\/[^\/]+\.bsky\.social\/post\/[A-Za-z0-9]+(?:[/?#].*)?$/i,
                
                // Bluesky web links with DID: https://bsky.app/profile/did:plc:<id>/post/<tid>
                /^(?:https?:\/\/)?bsky\.app\/profile\/did:plc:[a-z0-9]+\/post\/[A-Za-z0-9]+(?:[/?#].*)?$/i,
                
                // Any Bluesky web link (profile root etc.)
                /^(?:https?:\/\/)?bsky\.app\/(?:[?#].*|$|profile\/)/i,
                
                // AT Protocol URIs with proper format
                /^at:\/\/did:plc:[a-z0-9]+\/app\.bsky\.feed\.post\/[A-Za-z0-9]+$/i,
                
                // General AT Protocol URI pattern
                /^at:\/\//i,
                
                // bsky.social domains
                /\.bsky\.social(?:\/|$)/i,
            ],
            lightning: [
                // Lightning protocol scheme
                /^lightning:/i,
                // LNURL bech32 format (uppercase, 64+ chars)
                /\bLNURL[A-Z0-9]{60,}\b/i,
                // Lowercase lnurl variants 
                /\blnurl[a-z0-9]{60,}\b/i,
                // HTTPS URLs that might resolve to LNURL
                /^https:\/\/.*\?.*lightning/i,
            ],
            matrix: [
                // matrix.to share links
                /^(?:https?:\/\/)?matrix\.to\/#\/[#!@$+][^\/\s]+(?:\/[^\/\s]+)?(?:[/?#].*)?$/i,
                // Room aliases: #roomname:server.com
                /^#[^\s:]+:[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::\d+)?$/i,
                // User IDs: @username:server.com
                /^@[^\s:]+:[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::\d+)?$/i,
                // Event IDs: $eventid:server.com
                /^\$[^\s:]+:[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::\d+)?$/i,
                // Group/Community IDs: +groupname:server.com
                /^\+[^\s:]+:[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::\d+)?$/i,
            ],
            nostr: [
                // nostr identifiers based on link source
                /(?:nostr:|npub1|nprofile1|nevent1|note1|nrelay1|naddr1)[a-z0-9]+/i
            ],
            hive: [
                // Hive.blog posts: https://hive.blog/@username/permlink
                /^(?:https?:\/\/)?(?:www\.)?hive\.blog\/@[a-z0-9.-]+\/[a-z0-9-]+/i,
                // PeakD posts: https://peakd.com/@username/permlink  
                /^(?:https?:\/\/)?(?:www\.)?peakd\.com\/@[a-z0-9.-]+\/[a-z0-9-]+/i,
            ],
        };

        for (const [protocol, regexes] of Object.entries(patterns)) {
            if (regexes.some(regex => regex.test(url))) return protocol;
        }
        return 'disabled'; // Default fallback
    },


    /**
     * Extract username from URI based on protocol
     */
    extractUsername(uri, protocol) {
        switch (protocol) {
            case 'activitypub':
               // Post URLs with ID: https://defcon.social/@raynold_/123456789
                let match = uri.match(/^(?:https?:\/\/)?([^\/]+)\/@([^\/]+)\/(\d+)/);
                if (match) return { username: match[2], server: match[1], postId: match[3] };
                    
                // Profile pages: https://mastodon.archive.org/@internetarchive
                match = uri.match(/^(?:https?:\/\/)?([^\/]+)\/@([^\/]+)\/?$/);
                if (match) return { username: match[2], server: match[1] };

                // @user@server.domain format
                match = uri.match(/^@([^@]+)@(.+)$/);
                if (match) return { username: match[1], server: match[2] };
                
                // /@username pattern
                match = uri.match(/\/@([^\/]+)/);
                if (match) return { username: match[1] };
                
                // /users/username pattern  
                match = uri.match(/\/users\/([^\/]+)/);
                if (match) return { username: match[1] };
                
                return null;
                
            case 'twitter':
                const twitterMatch = uri.match(/(?:twitter\.com|x\.com)\/([^\/]+)/);
                return twitterMatch ? { username: twitterMatch[1] } : null;
                
            case 'atproto':
                const bskyMatch = uri.match(/(?:bsky\.app\/profile\/|profile\/)([^\/]+)/);
                return bskyMatch ? { username: bskyMatch[1] } : null;

            default:
                return null;
        }
    },


    /**
     * Build account ID from extracted username data
     */
    buildAccountId(usernameData, protocol) {
        if (!usernameData) return '';
        
        switch (protocol) {
            case 'activitypub':
                return usernameData.server 
                    ? `@${usernameData.username}@${usernameData.server}`
                    : `@${usernameData.username}`;
            case 'twitter':
                return `@${usernameData.username}`;
            case 'atproto':
                return `@${usernameData.username}`;
            default:
                return '';
        }
    },


    /**
     * Build profile URL from extracted username data
     */
    buildAccountUrl(usernameData, protocol) {
        if (!usernameData) return '';
        
        switch (protocol) {
            case 'activitypub':
                // e.x. https://defcon.social/@raynold_
                if (usernameData.server) {
                    return `https://${usernameData.server}/@${usernameData.username}`;
                }
                return ''; // need server info to build activitypub url
                
            case 'twitter':
                // e.x. https://x.com/AniTVOfficial/status/1962903164543193109
                // e.x. https://x.com/AniTVOfficial
                return `https://twitter.com/${usernameData.username}`;
                
            case 'atproto':
                // e.x. https://bsky.app/profile/rayo3o.bsky.social
                return `https://bsky.app/profile/${usernameData.username}`;
                
            default:
                return '';
        }
    },

    /**
     * Toggle function for disabling state
     */
    updateSectionDisabledState(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const disabled = slug.container.querySelector(`#disable-episode-comments-${feedSlug}`)?.checked;

        if (slug.tableContainer) {
            slug.tableContainer.style.opacity = disabled ? '0.5' : '1';
            slug.tableContainer.style.pointerEvents = disabled ? 'none' : 'auto';
        }
        
        // update form button state
        const formButton = slug.formContainer?.querySelector('[data-action="check-uri"]');
        if (formButton) {
            formButton.disabled = disabled; // Changed from always true to conditional
        }
        // update form input state
        const uriInput = slug.container.querySelector(`#social-interact-uri-input-${feedSlug}`);
        if (uriInput) {
            uriInput.disabled = disabled;
            uriInput.style.opacity = disabled ? '0.5' : '1';
        }
        // udpate message
        if (disabled) {
            showError('All Comments are disabled for this episode.', `social-interact-error-${feedSlug}`);
        } else {
            hideError(`social-interact-error-${feedSlug}`);
        }
    },


    /**
     * Toggle function for disabling a specific uri on data table (avoids delete)
     */
    updateUriDisabledState(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const tableRows = slug.container.querySelectorAll('tr[data-social-interact-id]');
        
        tableRows.forEach(row => {
            const protocolSelect = row.querySelector('select[data-field="protocol"]');
            const isDisabled = protocolSelect && protocolSelect.value === 'disabled';

            // Find input fields in row
            const inputs = row.querySelectorAll('input[data-field]:not([type="hidden"])');

            inputs.forEach(input => {
                input.disabled = isDisabled;
                input.style.opacity = isDisabled ? '0.5' : '1';
            });

            // Add/remove disabled indicator
            const uriCell = row.querySelector('[data-cell="uri"]');
            let indicator = row.querySelector('.disabled-indicator');
            
            if (isDisabled && !indicator && uriCell) {
                indicator = document.createElement('div');
                indicator.className = 'disabled-indicator';
                indicator.style.cssText = 'font-size: 12px; color: #666; font-style: italic; margin-top: 5px;';
                indicator.textContent = 'Comments disabled for this URI';
                uriCell.appendChild(indicator);
            } else if (!isDisabled && indicator) {
                indicator.remove();
            }
        });
    },


    /**
     * Change display of table based on existing row state
     */
    updateTableDisplay(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const table = slug.tableContainer || slug.container.querySelector(`#social-interact-table-container-${feedSlug}`);
        const tbody = slug._tbody || slug.tableContainer?.querySelector('tbody');
        const msg = slug.container.querySelector(`#social-interact-table-message-${feedSlug}`);

        if (tbody.querySelectorAll('tr[data-social-interact-id]').length === 0) {
            if (table) table.style.display = 'none';
            if (msg) msg.style.display = 'block';
        } else {
            if (table) table.style.display = 'block';
            if (msg) msg.style.display = 'none';
        }
    },


    /**
     * Get new ID for new social interact section, goes for highest value to avoid overlapping ID
     * @returns {number}
     */
    getNextId(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const existingInteracts = slug.container.querySelectorAll('tr[data-social-interact-id]');
        let maxId = 0;

        existingInteracts.forEach(interact => {
            const id = parseInt(interact.dataset.socialInteractId);
            if (id > maxId) maxId = id;
        });

        return maxId + 1;
    },


    /**
     * Clear input form
     */
    clearForm(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const uriInput = slug.container.querySelector(`#social-interact-uri-input-${feedSlug}`);
        if (uriInput) uriInput.value = '';

        const manualProtocolDiv = slug.container.querySelector(`#social-interact-manual-protocol-${feedSlug}`);
        if (manualProtocolDiv) {
            manualProtocolDiv.style.display = 'none';
        }

        hideError(`social-interact-error-${feedSlug}`);
        hideLoading(`social-interact-loading-${feedSlug}`);
    },
};



// =====================================================================================================================
//
//                                  EPISODE TXT TAGS
//
// =====================================================================================================================
function initTxtTagManager(feedSlug) {
    TxtTagManager.init(feedSlug);
}

/**
 * Txt Tag Managment system for Podcast2.0 Tag:
 * documentation: https://podcasting2.org/docs/podcast-namespace/tags/txt
 * Tag: <podcast:txt>
 *      Main Node: Free Form string, not to exceed 4000 characters
 *       Suported Attributes:
 *          - Purpose (optional)  A service specific string that will be used to denote what purpose this tag serves. 
 *                                This could be something like “example.com” if it’s a third party hosting platform needing to insert this data, or something 
 *                                like “verify”, “release” or any other free form bit of info that is useful to the end consumer that needs it. The free form 
 *                                nature of this tag requires that this attribute is also free formed. This value should not exceed 128 characters.
 * 
 */
const TxtTagManager = {
    feedSlugs: new Map(),


    getFeedSlug(feedSlug, containerElement) {
        if (!this.feedSlugs.has(feedSlug)) {
            const slug = {
                feedSlug: feedSlug,
                container: containerElement,
                formContainer: null,
                tableContainer: null,
                _tbody: null,
                isEditMode: false
            };
            this.feedSlugs.set(feedSlug, slug);
        }
        return this.feedSlugs.get(feedSlug);
    },
    
    /**
     * Initializer
     */
    init(feedSlug) {
        const container = document.getElementById(`txt-tag-container-${feedSlug}`);
        if (!container) return;
        
        const slug = this.getFeedSlug(feedSlug, container);

        slug.formContainer = container.querySelector(`#txt-tag-form-container-${feedSlug}`);
        slug.tableContainer = container.querySelector(`#txt-tag-table-container-${feedSlug}`);
        slug._tbody = slug.tableContainer?.querySelector('tbody') || null;

        // Form 'Enter' Handling
        const formContainer = container.querySelector(`#txt-tag-form-container-${feedSlug}`);
        if (formContainer) {
            formContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.target.matches('input') || e.target.matches('select'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.addTxtTag(feedSlug);
                    return false;
                }
            });
        }

        container.addEventListener('click', (e) => this.onClick(e, feedSlug));
        this.updateTableDisplay(feedSlug);
    },

    
    /**
     * Click event handler 
     * @param {event} e - click event
     * @returns when required dom element doesnt exist
     */
    onClick(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const el = e.target.closest('[data-action]');
        if (!el || !slug.container.contains(el)) return;

        switch(el.dataset.action) {
            case 'add-txt-tag':
                e.preventDefault();
                this.addTxtTag(feedSlug);
                break;
            case 'remove-txt-tag':
                e.preventDefault();
                this.removeTxtTag(el, feedSlug);
                break;
            case 'edit-txt-tag':
                e.preventDefault();
                this.editTxtTag(el, feedSlug);
                break;
        }
    },


    /**
     * Handler for editing an existing tag
     * @param {HTML Element} button - Edit button 
     * @returns when row doenst exist
     */
    editTxtTag(button, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const row = button.closest('tr[data-txt-tag-id]');
        if (!row) return;

        const existingData = this.extractTagDataFromRow(row);
        slug.isEditMode = true;
        this.updateFormEdit(existingData, feedSlug);

        row.remove();
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Extracts exisiting tag information from row
     * @param {HTML Object} row - row of existing tag
     * @returns {Object} tag object information
     */
    extractTagDataFromRow(row) {
        const tagId = parseInt(row.dataset.txtTagId);

        return  {
            id: tagId,
            tag: row.querySelector(`input[name*="[tag]"]`)?.value || '',
            purpose: row.querySelector(`input[name*="[purpose]"]`)?.value || ''
        };
    },

    /**
     * Populates form with the existingData
     * @param {Object} existingData - txt tag object from row
     */
    updateFormEdit(existingData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        slug.container.querySelector(`#txt-tag-content-input-${feedSlug}`).value = existingData.tag || '';
        slug.container.querySelector(`#txt-tag-purpose-input-${feedSlug}`).value = existingData.purpose || '';
    },


    /**
     * gets highest possible id, doenst grab immediately available numbers to avoid potential overlaps on delete
     * @returns new id
     */
    getNextId(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const existingTags = slug.container.querySelectorAll('tr[data-txt-tag-id]');
        let maxId = 0;

        existingTags.forEach(tag => {
            const id = parseInt(tag.dataset.txtTagId);
            if (id > maxId) maxId = id;
        });

        return maxId + 1;
    },


    /**
     * Add txt tag to table
     * @returns when no tag is provided or required dom elements dont exist
     */
    addTxtTag(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const tagInput = slug.container.querySelector(`#txt-tag-content-input-${feedSlug}`);
        const purposeInput = slug.container.querySelector(`#txt-tag-purpose-input-${feedSlug}`);

        if (!tagInput) {
            showError('Tag input not found!', `txt-tag-error-${feedSlug}`);
            return;
        }

        const tag = cleanHTMLTags(tagInput.value);
        const purpose = cleanHTMLTags(purposeInput?.value) || '';

        if (!tag) {
            showError('Tag content is required', 'txt-tag-error-${feedSlug}');
            return;
        }

        const txtTagData = {
            id: this.getNextId(feedSlug),
            tag: tag,
            purpose: purpose
        };

        this.addTxtTagRow(txtTagData, feedSlug);
        if (slug.isEditMode) slug.isEditMode = false;
        this.clearForm(feedSlug);
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Creates a new txt tag row via template and appends to exisitng table
     * @param {Object} txtTagData - new txt tag data
     * @returns when required dom elements dont exist
     */
    addTxtTagRow(txtTagData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug || !slug._tbody) return;

        const rowTemplate = slug.container.querySelector(`#txt-tag-row-template-${feedSlug}`);
        const node = rowTemplate.content.firstElementChild.cloneNode(true);
        const id = txtTagData.id;

        node.dataset.txtTagId = id;
        node.querySelector('[data-action="edit-txt-tag"]').dataset.txtTagId = id;
        node.querySelector('[data-action="remove-txt-tag"]').dataset.txtTagId = id;

        // display only first 64 chars on table, internally can be up to 4k chars
        const displayText = txtTagData.tag.length > 64 ?
           txtTagData.tag.substring(0, 61) + '...'
           : txtTagData.tag;

        node.querySelector('[data-cell="tag"] div').textContent = displayText;
        node.querySelector('[data-cell="tag"] div').title = txtTagData.tag; // show full text on hover using title

        // truncate purpose to 32 chars for display
        const purposeText = txtTagData.purpose || '-';
        const displayPurpose = purposeText.length > 32 ?
           purposeText.substring(0, 29) + '...'
           : purposeText;

        node.querySelector('[data-cell="purpose"]').textContent = displayPurpose;

        // update hidden inputs to match id for saving
        node.querySelectorAll('input[type="hidden"]').forEach(input => {
            input.name = input.name.replace('__ID__', id);
            if (/\[tag\]$/.test(input.name)) 
                input.value = txtTagData.tag;
            else if (/\[purpose\]$/.test(input.name)) 
                input.value = txtTagData.purpose || '';
        });

        slug._tbody.appendChild(node);
    },


    /**
     * Extracts row from button id and removes row
     * @param {HTML Element} button - clicked button
     */
    removeTxtTag(button, feedSlug) {
        const txtTagRow = button.closest('tr[data-txt-tag-id]');
        if (txtTagRow) {
            txtTagRow.remove();
            this.updateTableDisplay(feedSlug);
        }
    },

    
    /**
     * Update table display based on state of existing rows
     */
    updateTableDisplay(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const table = slug.tableContainer || slug.container.querySelector(`#txt-tag-table-container-${feedSlug}`);
        const tbody = slug._tbody || slug.tableContainer.querySelector('tbody');
        const msg = slug.container.querySelector(`#txt-tag-table-message-${feedSlug}`);

        // show empty table message if no rows
        if (tbody.querySelectorAll('tr[data-txt-tag-id]').length === 0) {
            if (table) table.style.display = 'none';
            if (msg) msg.style.display = 'block';
        } else {
            if (table) table.style.display = 'block';
            if (msg) msg.style.display = 'none';
        }
    },


    /**
     * Clear input form data and reset form state
     */
    clearForm(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        slug.container.querySelector(`#txt-tag-content-input-${feedSlug}`).value = '';
        slug.container.querySelector(`#txt-tag-purpose-input-${feedSlug}`).value = '';
        hideError(`txt-tag-error-${feedSlug}`);
    },
};

// =====================================================================================================================
//
//                                  EPISODE ALTERNATE ENCLOSURE
//
// =====================================================================================================================
function initAlternateEnclosureManager(feedSlug) {
    AlternateEnclosureManager.init(feedSlug);
}

/**
 * Alternate Enclosure Managment system for Podcast2.0 Tag:
 * documentation: https://podcasting2.org/docs/podcast-namespace/tags/alternate-enclosure
 * Tag: <podcast:alternateEnclosure>
 *      Main Node: <podcast:source> tags which define a uri where the media file can be downloaded or streamed
 *                 (OPTIONAL) <podcast:integrity> to allow for file integrity checking // TODO!!!
 *       Suported Attributes:
 *          - type: (required) Mime type of the media asset.
 *          - length: (recommended) Length of the file in bytes.
 *          - bitrate: (optional) Average encoding bitrate of the media asset, expressed in bits per second.
 *          - height: (optional) Height of the media asset for video formats.
 *          - lang: (optional) An IETF language tag (BCP 47) code identifying the language of this media.
 *          - title: (optional) A human-readable string identifying the name of the media asset. Should be limited to 32 characters for UX.
 *          - rel: (optional) Provides a method of offering and/or grouping together different media elements. If not set, or set to “default”, 
 *                  the media will be grouped with the enclosure and assumed to be an alternative to the enclosure’s encoding/transport. This attribute can
 *                  and should be the same for items with the same content encoded by different means. Should be limited to 32 characters for UX.
 *          - codecs: (optional) An RFC 6381 string specifying the codecs available in this media.
 *          - default: (optional) Boolean specifying whether or not the given media is the same as the file from the enclosure element and should be the 
 *                     preferred media element. The primary reason to set this is to offer alternative transports for the enclosure. If not set, this should be 
 *                     assumed to be false.
 * 
 */
const AlternateEnclosureManager = {
    feedSlugs: new Map(),
    hasHosting: false,
    adminUrl: '',

    getFeedSlug(feedSlug, containerElement) {
        if (!this.feedSlugs.has(feedSlug)) {
            const slug = {
                feedSlug: feedSlug,
                container: containerElement,
                formContainer: null,
                tableContainer: null,
                _tbody: null,
                currentEnclosureData: null,
                isEditMode: false
            };
            this.feedSlugs.set(feedSlug, slug);
        }
        return this.feedSlugs.get(feedSlug);
    },

    /**
     * Initializer
     */
    init(feedSlug) {
        const container = document.getElementById(`alternate-enclosure-container-${feedSlug}`);
        if (!container) return;

        const slug = this.getFeedSlug(feedSlug, container);

        slug.formContainer = container.querySelector(`#alternate-enclosure-form-container-${feedSlug}`);
        slug.tableContainer = container.querySelector(`#alternate-enclosure-table-container-${feedSlug}`);
        slug._tbody = slug.tableContainer?.querySelector('tbody') || null;

        // check hosting + admin url
        this.hasHosting = container?.dataset?.hasHosting === '1';
        this.adminUrl = container?.dataset?.adminUrl || '';

        container.addEventListener('click', (e) => this.onClick(e, feedSlug));
               
        // Form 'Enter' HandlingformContainer
        const initializerContainer = container.querySelector(`#alt-enclosure-url-form-${feedSlug}`);
        const confirmationContainer = container.querySelector(`#alt-enclosure-details-form-${feedSlug}`);
        if (initializerContainer) {
            initializerContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.target.matches('input') || e.target.matches('select'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.checkAlternateEnclosure(feedSlug);
                    return false;
                }
            });
        }

        if (confirmationContainer) {
            confirmationContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.target.matches('input') || e.target.matches('select'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.confirmAlternateEnclosure(feedSlug);
                    return false;
                }
            });
        }

        this.updateTableDisplay(feedSlug);
    },


    /**
     * Click handler for alternate enclosure container
     * @param {event} e - click event
     * @returns when dom element doesnt exist
     */
    onClick(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const el = e.target.closest('[data-action]');
        if (!el || !slug.container.contains(el)) return;

        switch(el.dataset.action) {
            case 'check-alt-enclosure':
                e.preventDefault();
                this.checkAlternateEnclosure(feedSlug);
                break;
            case 'confirm-alt-enclosure':
                e.preventDefault();
                this.confirmAlternateEnclosure(feedSlug);
                break;
            case 'cancel-alt-enclosure':
                e.preventDefault();
                this.cancelAlternateEnclosure(feedSlug);
                break;
            case 'remove-alt-enclosure':
                e.preventDefault();
                this.removeAlternateEnclosure(el, feedSlug);
                break;
            case 'toggle-enclosure-details':
                e.preventDefault();
                this.toggleEnclosureDetails(el, feedSlug);
                break;
            case 'add-uri-input':
                e.preventDefault();
                this.addUriInput('', feedSlug);
                break;
            case 'remove-uri-input':
                e.preventDefault();
                this.removeUriInput(el);
                break;
            case 'edit-alt-enclosure':
                e.preventDefault();
                this.editAlternateEnclosure(el, feedSlug);
                break;
        }
    },


    /**
     * Sets up detailed form after checking initial uri input
     * @returns when required DOM element doenst exist
     */
    checkAlternateEnclosure(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const urlInput = slug.container.querySelector(`#alt-enclosure-url-input-${feedSlug}`);
        if (!urlInput) return;
    
        const url = cleanHTMLTags(urlInput.value); 
        // fail when no url provided
        if (!url) {
            showError('Media URL is required', `alternate-enclosure-error-${feedSlug}`);
            return;
        }

        const enclosureData = {
            id: slug.isEditMode ? slug.currentEnclosureData.id : this.getNextId(feedSlug),
            url: url,
            title: '',
            bitrate: '',
            height: '',
            length: '',
            rel: '',
            lang: '',
            codecs: '',
            is_default: false,
            uris: [],
            hosting: slug.container.querySelector(`#alt-enclosure-url-input-${feedSlug}`)?.dataset.hosting || '0',
            program_keyword: slug.container.querySelector(`#alt-enclosure-url-input-${feedSlug}`)?.dataset.programKeyword || ''
        };
        slug.currentEnclosureData = enclosureData;
        this.showDetailsForm(slug.currentEnclosureData, feedSlug);
    },


    /**
     * Accepts detailed form data and add alternate enclosure data to table
     * @returns when requried dom element dont exist
     */
    confirmAlternateEnclosure(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const formData = this.extractConfirmationFormData(feedSlug);
        if (!formData) return;

        if (slug.isEditMode) {
            slug.isEditMode = false;
        }

        this.addAlternateEnclosureRow(formData, feedSlug);
        this.showUrlForm(feedSlug);
        this.updateTableDisplay(feedSlug);
    },

    
    /**
     * Cancels detailed form data and reverts to uri input form
     */
    cancelAlternateEnclosure(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        if (slug.isEditMode) {
            this.addAlternateEnclosureRow(slug.currentEnclosureData, feedSlug);
            slug.isEditMode = false;
        }
        this.showUrlForm(feedSlug);  
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Setup for extracting data from row and populating detailed form with existing data
     * @param {HTML Element} button - Edit buttton clicked
     * @returns when required DOM elements dont exist
     */
    editAlternateEnclosure(button, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const row = button.closest('tr[data-alt-enclosure-id]');
        if (!row) return;

        const existingData = this.extractEnclosureDataFromRow(row);
        slug.isEditMode = true;
        slug.currentEnclosureData = existingData;
        this.showDetailsForm(existingData, feedSlug);
        this.removeAlternateEnclosure(button, feedSlug);
    },


    /**
     * Extracts data from hidden inputs of row
     * @param {HTML Element} row  - exiting alternate enclosure row with data
     * @returns alternate enclosure row data
     */
    extractEnclosureDataFromRow(row) {
        const enclosureId = row.dataset.altEnclosureId;
        
        return {
            id: parseInt(enclosureId),
            url: row.querySelector(`input[name*="[alternate_enclosure][${enclosureId}][url]"]`)?.value || '',
            title: row.querySelector(`input[name*="[alternate_enclosure][${enclosureId}][title]"]`)?.value || '',
            bitrate: row.querySelector(`input[name*="[alternate_enclosure][${enclosureId}][bitrate]"]`)?.value || '',
            height: row.querySelector(`input[name*="[alternate_enclosure][${enclosureId}][height]"]`)?.value || '',
            length: row.querySelector(`input[name*="[alternate_enclosure][${enclosureId}][length]"]`)?.value || '',
            rel: row.querySelector(`input[name*="[alternate_enclosure][${enclosureId}][rel]"]`)?.value || '',
            lang: row.querySelector(`input[name*="[alternate_enclosure][${enclosureId}][lang]"]`)?.value || '',
            codecs: row.querySelector(`input[name*="[alternate_enclosure][${enclosureId}][codecs]"]`)?.value || '',
            is_default: row.querySelector(`input[name*="[alternate_enclosure][${enclosureId}][default]"]`)?.value === '1',
            uris: this.extractUrisFromRow(row)
        };
    },


    /**
     * Extracts data from uri hidden input elements
     * @param {HTML Element} row - existing alternate enclosure row with data
     * @returns URI data
     */
    extractUrisFromRow(row) {
        const uris = [];
        const uriInputs = row.querySelectorAll(`input[data-field="alt-enc-save-uri"]`);
        uriInputs.forEach(input => {
            const v = input.value.trim();
            if (v) {
                const hostingInput = row.querySelector(`input[data-field="alt-enc-uri-hosting"][data-uri-index="${input.dataset.uriIndex}"]`);
                uris.push({
                    uri: v,
                    hosting: hostingInput ? hostingInput.value : ''
                });
            }
        });
        return uris;
    },


    /**
     * extracts existing detailed form data and returns as object
     * @returns nothing when data doesnt exist, updated data when it does
     */
    extractConfirmationFormData(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug || !slug.currentEnclosureData) return null;

        const title = cleanHTMLTags(document.getElementById(`confirm-alt-title-${feedSlug}`)?.value) || '';
        const bitrate = cleanHTMLTags(document.getElementById(`confirm-alt-bitrate-${feedSlug}`)?.value) || '';
        const height = cleanHTMLTags(document.getElementById(`confirm-alt-height-${feedSlug}`)?.value) || '';
        const lang = cleanHTMLTags(document.getElementById(`confirm-alt-lang-${feedSlug}`)?.value) || '';
        const rel = cleanHTMLTags(document.getElementById(`confirm-alt-rel-${feedSlug}`)?.value) || '';
        const codecs = cleanHTMLTags(document.getElementById(`confirm-alt-codecs-${feedSlug}`)?.value) || '';
        const is_default = document.getElementById(`confirm-alt-default-${feedSlug}`)?.checked || false;

        const uris = [];
        const uriInputs = slug.container.querySelectorAll('[data-field="alt-enc-uri-input"]');
        uriInputs.forEach(input => {
            if (input.value.trim()) {
                const hostingField = slug.container.querySelector(`#${input.id}-hosting`);
                uris.push({
                    uri: cleanHTMLTags(input.value),
                    hosting: hostingField ? hostingField.value : ''
                });
            }
        });

        const hosting = slug.container.querySelector(`#alt-enclosure-details-form-${feedSlug}`).dataset.hosting;
        const program_keyword = slug.container.querySelector(`#alt-enclosure-details-form-${feedSlug}`).dataset.programKeyword;

        return {
            ...slug.currentEnclosureData,
            title,
            bitrate,
            height,
            lang,
            rel,
            codecs,
            is_default,
            uris,
            hosting,
            program_keyword
        };
    },


    /**
     * Reset main form and display
     */
    showUrlForm(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        slug.container.querySelector(`#alt-enclosure-url-form-${feedSlug}`).style.display = 'block';
        slug.container.querySelector(`#alt-enclosure-details-form-${feedSlug}`).style.display = 'none';
        this.clearUrlForm(feedSlug);
        hideError(`alternate-enclosure-error-${feedSlug}`);
        slug.currentEnclosureData = null;
        slug.isEditMode = false;
    },


    /**
     * Display detailed form with provided enclosureData
     * @param {Object} enclosureData - alternate enclosure data
     */
    showDetailsForm(enclosureData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        slug.container.querySelector(`#confirm-alt-title-${feedSlug}`).value = enclosureData.title || '';
        slug.container.querySelector(`#confirm-alt-bitrate-${feedSlug}`).value = enclosureData.bitrate || '';
        slug.container.querySelector(`#confirm-alt-height-${feedSlug}`).value = enclosureData.height || '';
        slug.container.querySelector(`#confirm-alt-lang-${feedSlug}`).value = enclosureData.lang || '';
        slug.container.querySelector(`#confirm-alt-rel-${feedSlug}`).value = enclosureData.rel || '';
        slug.container.querySelector(`#confirm-alt-codecs-${feedSlug}`).value = enclosureData.codecs || '';

        const urlDisplay = slug.container.querySelector(`#alt-enclosure-url-display-${feedSlug}`);
        if (urlDisplay) {
            urlDisplay.textContent = `URL: ${enclosureData.url.trim()}`;
        }
  
        this.clearUriInputs(feedSlug);
        if (enclosureData.uris && enclosureData.uris.length > 0) {
            enclosureData.uris.forEach(uriArr => {
                if (uriArr.uri.trim() !== '')
                    this.addUriInput(uriArr.uri, feedSlug);
            });
        }

        slug.container.querySelector(`#alt-enclosure-details-form-${feedSlug}`).dataset.hosting = enclosureData.hosting || '0';
        slug.container.querySelector(`#alt-enclosure-details-form-${feedSlug}`).dataset.programKeyword = enclosureData.program_keyword || '';

        slug.container.querySelector(`#alt-enclosure-url-form-${feedSlug}`).style.display = 'none';
        slug.container.querySelector(`#alt-enclosure-details-form-${feedSlug}`).style.display = 'block';
        hideError(`alternate-enclosure-error-${feedSlug}`);
    },


    /**
     * Adds uri to detailed form, also used for populating on edit
     * @param {HTML Element's value} presetValue - existing value for existing uri
     * @returns 
     */
    addUriInput(presetValue = '', feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const container = slug.container.querySelector(`#uri-inputs-container-${feedSlug}`);
        const template = slug.container.querySelector(`#uri-input-template-${feedSlug}`);
        if (!container || !template) return;

        const node = template.content.cloneNode(true);
        const input = node.querySelector('[data-field="alt-enc-uri-input"]');
        if (!input) return;

        const enclosureId = slug.currentEnclosureData?.id || this.getNextId(feedSlug);
        const nextIdx = this.getNextUriIndex(enclosureId, feedSlug);
        
        // setup for powerpress-jquery-media action
        const targetId = `alt-enc-uri-${enclosureId}-${nextIdx}`;
        input.id = targetId;
        if (presetValue) input.value = presetValue;

        const hostingField = node.querySelector('[data-field="alt-enc-uri-hosting"]');
        if (hostingField) {
            hostingField.id = `${targetId}-hosting`;
        }
        const programKeywordField = node.querySelector('[data-field="alt-enc-uri-program-keyword"]');
        if (programKeywordField) {
            programKeywordField.id = `${targetId}-program-keyword`
        }

        // URI Choose File from Blubrry
        const pickLink = node.querySelector('[data-action="pick-blubrry-uri"]');
        if (this.hasHosting && pickLink) {
            const href = `${this.adminUrl}?action=powerpress-jquery-media` +
          `&podcast-feed=${encodeURIComponent(feedSlug)}` +
          `&target_field=${encodeURIComponent(targetId)}` +
          `&KeepThis=true&TB_iframe=true&modal=false`;
        pickLink.href = href;
        pickLink.style.display = 'inline-block'
        }

        container.appendChild(node);
    },


    /**
     * extract row data from pressed button and remove row
     * @param {HTML Element} button - remove button pressed
     */
    removeUriInput(button) {
        const uriRow = button.closest('.uri-input-row');
        if (uriRow) {
            uriRow.remove();
        }
    },


    /**
     * Clear uri input by overwriting innerHTML
     */
    clearUriInputs(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const uriInput = slug.container.querySelector(`#uri-inputs-container-${feedSlug}`);
        if (uriInput) {
            uriInput.innerHTML = '';
        }
    },


    /**
     * Toggle row details element and button appearance
     * @param {HTML Element} button - Detailed view button
     */
    toggleEnclosureDetails(button, feedSlug) {
        const enclosureId = button.dataset.altEnclosureId;
        const detailRow = document.querySelector(`tr[data-detail-for="${enclosureId}"][data-feed-slug="${feedSlug}"]`);
        const expandBtn = button;

        if (detailRow) {
            const isVisible = detailRow.style.display !== 'none';
            detailRow.style.display = isVisible ? 'none' : 'table-row';
            expandBtn.textContent = isVisible ? '▼' : '▲';
        }
    },


    /**
     * Generate new HTML row from template, populate data and append new element to table
     * @param {Object} enclosureData - alternate enclosure object
     * @returns 
     */
    addAlternateEnclosureRow(enclosureData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug || !slug._tbody) return;

        const mainTemplate = slug.container.querySelector(`#alt-enclosure-row-template-${feedSlug}`);
        const detailTemplate = slug.container.querySelector(`#alt-enclosure-detail-template-${feedSlug}`);
        
        const mainNode = mainTemplate.content.firstElementChild.cloneNode(true);
        const detailNode = detailTemplate.content.firstElementChild.cloneNode(true);
        
        const id = enclosureData.id;

        // Setup main row data attributes 
        mainNode.dataset.altEnclosureId = id;
        mainNode.querySelector('[data-action="toggle-enclosure-details"]').dataset.altEnclosureId = id;
        mainNode.querySelector('[data-action="edit-alt-enclosure"]').dataset.altEnclosureId = id;
        mainNode.querySelector('[data-action="remove-alt-enclosure"]').dataset.altEnclosureId = id;

        // Populate main row cells
        renderSafeLink(mainNode.querySelector('[data-cell="url"]'), enclosureData.url, true);

        mainNode.querySelector('[data-cell="title"]').textContent = cleanHTMLTags(enclosureData.title) || '—';
        mainNode.querySelector('[data-cell="bitrate"]').textContent = (enclosureData.bitrate && enclosureData.bitrate !== '0') ? cleanHTMLTags(enclosureData.bitrate) : '—';
        mainNode.querySelector('[data-cell="height"]').textContent = (enclosureData.height && enclosureData.height !== '0') ? cleanHTMLTags(enclosureData.height) : '—';
        mainNode.querySelector('[data-cell="lang"]').textContent = cleanHTMLTags(enclosureData.lang) || '—';
        mainNode.querySelector('[data-cell="default"]').textContent = cleanHTMLTags(enclosureData.is_default) ? '✓' : '—';

        // Update hidden inputs w ID replacements
        mainNode.querySelectorAll('input[type="hidden"][name*="Powerpress["]').forEach(input => {
            if (input.name.includes('[__ID__]')) {
                input.name = input.name.replace('__ID__', id);
            }
            if (input.id) {
                input.id = input.id.replace('__ID__', id);
            }

            let val = '';
            if (/url\]$/.test(input.name))
                 val = cleanHTMLTags(enclosureData.url);
            else if (/title\]$/.test(input.name)) 
                val = cleanHTMLTags(enclosureData.title) || '';
            else if (/bitrate\]$/.test(input.name)) 
                val = cleanHTMLTags(enclosureData.bitrate) || '';
            else if (/height\]$/.test(input.name))
                val = cleanHTMLTags(enclosureData.height) || '';
            else if (/length\]$/.test(input.name))
                val = cleanHTMLTags(enclosureData.length) || '';
            else if (/rel\]$/.test(input.name))
                val = cleanHTMLTags(enclosureData.rel) || '';
            else if (/lang\]$/.test(input.name))
                val = cleanHTMLTags(enclosureData.lang) || '';
            else if (/codecs\]$/.test(input.name))
                val = cleanHTMLTags(enclosureData.codecs) || '';
            else if (/hosting\]$/.test(input.name))
                val = cleanHTMLTags(enclosureData.hosting) || '';
            else if (/program_keyword\]$/.test(input.name))
                val = cleanHTMLTags(enclosureData.program_keyword) || '';

            input.value = val;
            input.setAttribute('value', val);
        });

        if (enclosureData.is_default) {
          const hiddenCell = slug.container.querySelector(`[data-field="save-data"]`);
          const def = document.createElement('input');
          def.type = 'hidden';
          def.name = `Powerpress[${feedSlug}][alternate_enclosure][${id}][default]`;
          def.value = '1';
          def.setAttribute('value', '1');
          hiddenCell.appendChild(def);
        }

        // setup detail row
        detailNode.dataset.detailFor = id;
        detailNode.querySelector('[data-cell="rel"]').textContent = cleanHTMLTags(enclosureData.rel) || 'N/A';
        detailNode.querySelector('[data-cell="codecs"]').textContent = cleanHTMLTags(enclosureData.codecs) || 'N/A';
        detailNode.querySelector('[data-cell="length"]').textContent = cleanHTMLTags(enclosureData.length) || 'N/A';
        detailNode.querySelector('[data-cell="url-display"]').textContent = cleanHTMLTags(enclosureData.url) || '—';
        
        // handle URIs
        const urisContainer = detailNode.querySelector('[data-cell="uris"]');
        urisContainer.replaceChildren();

        if (enclosureData.uris && enclosureData.uris.length > 0) {
           for (const uriData of enclosureData.uris) {
                const uri = (typeof uriData === 'string') ? uriData : uriData.uri;
                const row = document.createElement('div');
                row.style.fontSize = '12px';
                row.style.color = '#666';
                row.style.marginBottom = '4px';

                renderSafeLink(row, uri, true, false);
                urisContainer.appendChild(row);
            }
         
            // add hidden URI inputs 
            enclosureData.uris.forEach((uriData, index) => {
                const uri = (typeof uriData === 'string') ? uriData : uriData.uri;
                const hosting = (typeof uriData === 'string') ? '' : uriData.hosting;
                const uriIndex = index + 1;
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.setAttribute('data-field', 'alt-enc-save-uri'); 
                hiddenInput.setAttribute('data-alt-enc-idx', id);
                hiddenInput.setAttribute('data-uri-index', uriIndex);
                hiddenInput.name = `Powerpress[${feedSlug}][alternate_enclosure][${id}][uris][${uriIndex}][uri]`;
                hiddenInput.value = cleanHTMLTags(uri);
                hiddenInput.setAttribute('value', uri);

                const hiddenHosting = document.createElement('input');
                hiddenHosting.type = 'hidden';
                hiddenHosting.setAttribute('data-field', 'alt-enc-uri-hosting'); 
                hiddenHosting.setAttribute('data-alt-enc-idx', id);
                hiddenHosting.setAttribute('data-uri-index', uriIndex);
                hiddenHosting.name = `Powerpress[${feedSlug}][alternate_enclosure][${id}][uris][${uriIndex}][hosting]`;
                
                hiddenHosting.value = hosting;
                hiddenHosting.setAttribute('value', hosting);

                mainNode.querySelector('td[data-field="save-data"]').appendChild(hiddenInput);
                mainNode.querySelector('td[data-field="save-data"]').appendChild(hiddenHosting);
            });
        }

        slug._tbody.appendChild(mainNode);
        slug._tbody.appendChild(detailNode);
    },


    /**
     * Remove alternate enclosure row using data extracted from remove button
     * @param {HTML Element} button - remove button
     */
    removeAlternateEnclosure(button, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const enclosureId = button.dataset.altEnclosureId;
        const mainRow = button.closest('tr[data-alt-enclosure-id]');
        const detailRow = slug.container.querySelector(`tr[data-detail-for="${enclosureId}"][data-feed-slug="${feedSlug}"]`);
        
        if (mainRow) mainRow.remove();
        if (detailRow) detailRow.remove();

        this.updateTableDisplay(feedSlug);
    },


    /**
     * Update table display based on existing row state
     */
    updateTableDisplay(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const table = slug.tableContainer || slug.container.querySelector(`#alternate-enclosure-table-container-${feedSlug}`);
        const tbody = slug._tbody || slug.tableContainer?.querySelector('tbody');
        const msg = slug.container.querySelector(`#alternate-enclosure-table-message-${feedSlug}`);

        if (tbody.querySelectorAll('tr[data-alt-enclosure-id]').length === 0) {
            if (table) table.style.display = 'none';
            if (msg) msg.style.display = 'block';
        } else {
            if (table) table.style.display = 'block';
            if (msg) msg.style.display = 'none';
        }
    },


    /**
     * Clear data from url form
     */
    clearUrlForm(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const urlInput = slug.container.querySelector(`#alt-enclosure-url-input-${feedSlug}`);
        if (urlInput) {
            urlInput.value = '';
        }
        hideError(`alternate-enclosure-error-${feedSlug}`);
    },


    /**
     * get next id by finding next max id value, prevents overlap on delete or when using length
     * @returns next max id
     */
    getNextId(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const existingEnclosures = slug.container.querySelectorAll(`tr[data-alt-enclosure-id]`);
        let maxId = 0;

        existingEnclosures.forEach(enclosure => {
            const id = parseInt(enclosure.dataset.altEnclosureId);
            if (id > maxId) maxId = id;
        });
        return maxId + 1;
    },


    /**
     * find all matching ids and try to create new maxid based on the existing values
     * @param {string} enclosureId 
     * @returns 
     */
    getNextUriIndex(enclosureId, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const container = slug.container.querySelector(`#uri-inputs-container-${feedSlug}`);
        if (!container) return 1;

        const pattern = new RegExp(`^alt-enc-uri-${enclosureId}-(\\d+)$`);
        let maxIdx = 0;

        container.querySelectorAll('[data-field="alt-enc-uri-input"][id]').forEach(input => {
          const match = input.id.match(pattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxIdx) maxIdx = num;
          }
        });

        return maxIdx + 1;
    }
};

// =====================================================================================================================
//
//                                  EPISODE CONTENT LINKS
//
// =====================================================================================================================
function initContentLinksManager(feedSlug) {
    ContentLinksManager.init(feedSlug);
}

/**
 * Content Link Managment system for Podcast2.0 Tag:
 * documentation: https://podcasting2.org/docs/podcast-namespace/tags/content-link
 * Tag: <podcast:contentLink>
 *      Main Node: Free-form string that explains to the user where this content link points and or the nature of its purpose
 *       Suported Attributes:
 *          - href (required) A string that is the uri pointing to content outside of the applications
 */
const ContentLinksManager = {
    feedSlugs: new Map(),

    getFeedSlug(feedSlug, containerElement) {
        if (!this.feedSlugs.has(feedSlug)) {
            const slug = {
                feedSlug: feedSlug,
                container: containerElement,
                formContainer: null,
                tableContainer: null,
                _tbody: null,
                isEditMode: false
            };
            this.feedSlugs.set(feedSlug, slug);
        }
        return this.feedSlugs.get(feedSlug);
    },

    /**
     * Initializer
     */
    init(feedSlug) {
        const container = document.getElementById(`content-link-container-${feedSlug}`);
        if (!container) return;

        const slug = this.getFeedSlug(feedSlug, container);

        slug.formContainer = container.querySelector(`#content-link-form-${feedSlug}`);
        slug.tableContainer = container.querySelector(`#content-link-table-container-${feedSlug}`);
        slug._tbody = slug.tableContainer?.querySelector('tbody') || null;

        // event handler binding
        container.addEventListener('click', (e) => this.onClick(e, feedSlug));

        // Form 'Enter' Handling
        const formContainer = container.querySelector(`#content-link-form-container-${feedSlug}`);
        if (formContainer) {
            formContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.target.matches('input') || e.target.matches('select'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.addContentLink(feedSlug);
                    return false;
                }
            });
        }

        this.updateTableDisplay(feedSlug);
    },

    /**
     * Click event handler for content link container
     * @param {Event} e - click event
     * @returns when required elements dont exist
     */
    onClick(e, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const el = e.target.closest('[data-action]');
        if (!el || !slug.container.contains(el)) return;

        switch(el.dataset.action) {
            case 'add-content-link':
                e.preventDefault();
                this.addContentLink(feedSlug);
                break;
            case 'remove-content-link':
                e.preventDefault();
                this.removeContentLink(el, feedSlug);
                break;
            case 'edit-content-link':
                e.preventDefault();
                this.editContentLink(el, feedSlug);
                break;
        }
    },

    editContentLink(button, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const row = button.closest('tr[data-content-link-id]');
        if (!row) return;

        const existingData = this.extractContentLinkDataFromRow(row);
        slug.isEditMode = true;
        this.updateFormEdit(existingData, feedSlug);

        row.remove();
        this.updateTableDisplay(feedSlug);
    },

    extractContentLinkDataFromRow(row) {
        const tagId = parseInt(row.dataset.contentLinkId);

        return {
            id: tagId,
            url: cleanHTMLTags(row.querySelector(`input[name*="[url]"]`)?.value) || '',
            label: cleanHTMLTags(row.querySelector(`input[name*="[label]"]`)?.value) || ''
        }
    },

    updateFormEdit(existingData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        slug.container.querySelector(`#content-link-url-input-${feedSlug}`).value = existingData.url || '';
        slug.container.querySelector(`#content-link-label-input-${feedSlug}`).value = existingData.label || '';
    },


    /**
     * Creates a new content link object linkData and gets a new row added from it
     * @returns when required dom elements dont exist
     */
    addContentLink(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const urlInput = slug.container.querySelector(`#content-link-url-input-${feedSlug}`);
        const labelInput = slug.container.querySelector(`#content-link-label-input-${feedSlug}`);

        if (!urlInput) {
            showError('URL input not found!', `content-link-error-${feedSlug}`);
            return;
        }

        const url = cleanHTMLTags(urlInput.value);
        const label = cleanHTMLTags(labelInput?.value) || '';

        if (!url) {
            showError('URL is required', `content-link-error-${feedSlug}`);
            return;
        }

        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'at:') {
                showError('URL must use http:// or https:// protocol', `content-link-error-${feedSlug}`);
                return;
            }
        } catch (e) {
            showError('Invalid URL format. Please enter a valid URL. Ensure you include the http(s): protocol.', `content-link-error-${feedSlug}`);
            return;
        }

        const linkData = {
            id: this.getNextId(feedSlug),
            url: url,
            label: label
        };

        this.addContentLinkRow(linkData, feedSlug);
        this.clearForm(feedSlug);
        if (slug.isEditMode) slug.isEditMode = false;
        this.updateTableDisplay(feedSlug);
    },


    /**
     * Creates a new content link row from the data provided and a template before appending it to the table container
     * @param {Object} linkData - content link data {id, url, label}
     * @returns when required dom elements dont exist
     */
    addContentLinkRow(linkData, feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug || !slug._tbody) return;

        // Clone node + new node setup
        const rowTemplate = slug.container.querySelector(`#content-link-row-template-${feedSlug}`);
        const node = rowTemplate.content.firstElementChild.cloneNode(true);
        const id = linkData.id;

        node.dataset.contentLinkId = id;
        node.querySelector('[data-action="remove-content-link"]').dataset.contentLinkId = id;

        const urlLink = node.querySelector('[data-cell="url"]');
        renderSafeLink(urlLink, linkData.url, false);
        
        node.querySelector('[data-cell="label"]').textContent = linkData.label || '-';

        node.querySelectorAll('input[type="hidden"]').forEach(input => {
            input.name = input.name.replace('__ID__', id);
            if (/\[url\]$/.test(input.name))
                input.value = linkData.url;
            else if (/\[label\]$/.test(input.name))
                input.value = linkData.label || '';
        });

        slug._tbody.appendChild(node);
    },


    /**
     * Removes row based on information derived from button clicked
     * @param {HTML Element} button - remove button
     */
    removeContentLink(button, feedSlug) {
        const linkRow = button.closest('tr[data-content-link-id]');
        if (linkRow) {
            linkRow.remove();
            this.updateTableDisplay(feedSlug);
        }
    },


    /**
     * update the display of the tabel based on the state of rows
     */
    updateTableDisplay(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        const tableWrap = slug.tableContainer;
        const tbody = slug._tbody;
        const msg = slug.container.querySelector(`#content-link-table-message-${feedSlug}`);

        // display empty table message when no rows
        if (tbody.querySelectorAll('tr[data-content-link-id]').length === 0) {
            if (tableWrap) tableWrap.style.display = 'none';
            if (msg) msg.style.display = 'block';
        } else {
            if (msg) msg.style.display = 'none';
            if (tableWrap) tableWrap.style.display = 'block';
        }
    },


    /**
     * Clear main input form of data
     */
    clearForm(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return;

        slug.container.querySelector(`#content-link-url-input-${feedSlug}`).value = '';
        slug.container.querySelector(`#content-link-label-input-${feedSlug}`).value = '';
        hideError(`content-link-error-${feedSlug}`);
    },


    /**
     * Gets next highest id, prevents overlapping issues on delete or when using length
     * @returns next highest id
     */
    getNextId(feedSlug) {
        const slug = this.feedSlugs.get(feedSlug);
        if (!slug) return 1;

        const existingLinks = slug.container.querySelectorAll(`tr[data-content-link-id]`);
        let maxId = 0;

        existingLinks.forEach(link => {
            const id = parseInt(link.dataset.contentLinkId);
            if (id > maxId) maxId = id;
        });

        return maxId + 1;
    },
};

// ==============================
//  Commonly Used Utils
// =============================

/**
 * Checks if URL is qualified and returns a truncated text display or -
 * @param {el} cell - element to store the URL text
 * @param {url} raw - raw url passed by user
 * @returns 
 */
function renderSafeLink(cell, raw, strict = false, truncate = true) {
    if (!cell) return;
  
    // default placeholder
    cell.textContent = '-';
  
    if (!raw) return;
    raw = String(raw).trim();
    if (!raw) return;
  
    if (strict) {
      // Only accept valid http(s) URLs
      try {
        const u = new URL(raw);
        if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'at:') {
          cell.textContent = 'Unresolved URL';
          return;
        }
      } catch {
        cell.textContent = 'Unresolved URL';
        return;
      }
    }
    let display = raw;
    // strip protocol (http(s):// or at://) and truncate
    if (truncate) {
        try {
            const url = new URL(raw);
            const pathname = url.pathname;
            // extract just the filename from the pathname
            const lastSlash = pathname.lastIndexOf('/');
            display = lastSlash >= 0 ? pathname.substring(lastSlash) : pathname;
            // If pathname is just "/" or empty, use the full URL minus protocol
            if (display === '/' || !display) {
                display = raw.replace(/^https?:\/\//i, '');
                display = display.replace(/^at:\/\//i, '');
            }
        } catch {
            // If not a valid URL, just strip protocol
            display = raw.replace(/^https?:\/\//i, '');
            display = display.replace(/^at:\/\//i, '');
        }
        if (display.length > 32) display = display.slice(0, 29) + '...';
    }
    const div = document.createElement('div');
    div.textContent = display;
    div.title = raw;
    div.style.fontSize = 'clamp(10px, 2.5vw, 14px)';
    div.style.display = 'inline-block';
    div.style.maxWidth = '100%';
    div.style.overflow = 'hidden';
    div.style.textOverflow = 'ellipsis';
    div.style.whiteSpace = 'nowrap';

    cell.replaceChildren(div);
}



/**
 * Collapse section and update display
 * @param collapseSelector - the visible menu container when the form is collapsed
 * @param collapseStateSelector - the symbol to modify
 * @returns early fail if no collapse container
 */
function toggleVisibility(toggle, collapseSelector) {
    const collapse = document.getElementById(collapseSelector);
    const triangle = toggle.querySelector('button');
    if (!collapse || !triangle) return;

    if (collapse.dataset.state === 'hidden') {
        collapse.style.display = '';
        collapse.dataset.state = 'visible';
        triangle.title="Collapse Form";
        triangle.textContent = "▲";
    } else {
        collapse.style.display = 'none';
        collapse.dataset.state = 'hidden';
        triangle.title="Expand Form";
        triangle.textContent = "▼";
    }
}

/**
* Show info to user regarding status changes
* @param message
*/
function showInfo(message, elementId) {
    const errorDiv = document.getElementById(elementId);
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.style.backgroundColor = '#d1ecf1';
        errorDiv.style.borderColor = '#bee5eb';
        errorDiv.style.color = '#0c5460';
    }
}

    
/**
 * display error messages
 * @param message
 */
function showError(message, elementId) {
    const errorDiv = document.getElementById(elementId);
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.style.backgroundColor = '#f8d7da';
        errorDiv.style.borderColor = '#f5c6cb';
        errorDiv.style.color = '#721c24';
    }
}


/**
 * Display loading status
 */
function showLoading(elementId) {
    const loadingDiv = document.getElementById(elementId);
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
    }
}


/**
 * Hide Loading status
 */
function hideLoading(elementId) {
    const loadingDiv = document.getElementById(elementId);
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
}
    

/**
 * Hide Error status
 */
function hideError(elementId) {
    const errorDiv = document.getElementById(elementId);
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}


/**
 * Clean HTML from input string
 */
function cleanHTMLTags(input) {
    if (!input) return '';
    return input.replace(/<[^>]*>/g, '').trim();
}


window.toggleVisibility = toggleVisibility;
window.initLocationManager = initLocationManager;
window.initCreditsManager = initCreditsManager;
window.initValueRecipientManager = initValueRecipientManager;
window.initSoundbitesManager = initSoundbitesManager;
window.initSocialInteractManager = initSocialInteractManager;
window.initTxtTagManager = initTxtTagManager;
window.initAlternateEnclosureManager = initAlternateEnclosureManager;
window.initContentLinksManager = initContentLinksManager;

})(window);