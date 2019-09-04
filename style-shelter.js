export default {
    /**
     * get default configuration
     * @returns {{baseURI: string, theme: string}|*}
     */
    get config() {
        return {
            append: [document],
            onSuccess: null,
            onError: function (err, message) {
                console.warn(err, err.message);
            }
        }
    },

    /**
     * adopt a list of sheets or sheet objects
     * @param sheetObjects - array of CSS URLs or objects containing url and scope keys
     * @param defaultScope - scope to adopt CSS like document or shadow root
     * @param config
     * @return unadopted array of stylesheet objects because scope was not found
     */
    adopt(sheetObjects, defaultScope, config) {
        if (!config) {
            config = this.config;
        }
        const scopes = new WeakMap();
        const scopekeys = [];
        if (defaultScope) {
            scopekeys.push(defaultScope);
            scopes.set(defaultScope, { stylesheets: [] });
        }

        // Gather sheets, and resolve to CSSStyleSheet objects
        const unadopted = [];
        sheetObjects.forEach( sheet => {
            if (typeof sheet === 'string') {
                const stylesheet = this.getSheet(sheet, config.onSuccess, config.onError);
                if (!defaultScope) {
                    // no default scope and no info about where to adopt, defer adoption and return unadopted sheets
                    unadopted.push(stylesheet);
                } else {
                    // adopt to scope
                    scopes.get(defaultScope).stylesheets.push(stylesheet);
                }
            } else {
                let scope;
                if (sheet.scope) {
                    scope = sheet.scope;
                } else if (defaultScope) {
                    scope = defaultScope;
                }

                const stylesheet = this.getSheet(sheet.url, config.onSuccess, config.onError);

                if (scope) { // scope was found, adopt to scope here
                    if (!scopes.has(scope)) {
                        scopekeys.push(scope);
                        scopes.set(scope, {stylesheets: []});
                    }
                    scopes.get(scope).stylesheets.push(stylesheet);
                } else { // scope not found defer adoption, and return unadopted sheets
                    unadopted.push(stylesheet)
                }
            }
        });

        // Adopt sheet arrays per scope
        scopekeys.forEach( scope => {
            if (config.append.indexOf(scope) !== -1) {
                scope.adoptedStyleSheets = scope.adoptedStyleSheets.concat(scopes.get(scope).stylesheets);
            } else {
                scope.adoptedStyleSheets = scopes.get(scope).stylesheets;
            }
        });

        return unadopted
    },

    /**
     * Load or retrieve cached a list of style sheets
     * @param urls
     * @param callback
     * @param error
     * @returns {Array}
     */
    getSheets(urls, callback, error) {
        if (!Array.isArray(urls)) {
            urls = [urls];
        }
        const sheets = [];
        for (let c = 0; c < urls.length; c++) {
            sheets.push(this.getSheet(urls[c], callback, error));
        }
        return sheets;
    },

    /**
     * Load or retrieve cached style sheet
     * @param url
     * @param callback
     * @param error
     * @returns {CSSStyleSheet}
     * @private
     */
    getSheet(url, callback, error) {
        if (!this._dict) {
            this._dict = new Map();
        }
        if (!this._failed) {
            this._failed = new Map();
        }

        if (this._dict.has(url)) {
            return this._dict.get(url);
        } else if (this._failed.has(url)) {
            error.apply(this, [this._failed.get(url)]);
            return this._dict.get(url);
        } else {
            const sheet = new CSSStyleSheet();
            sheet.replace(`@import url("${url}")`)
                .then(sheet => {
                    if (callback) {
                        callback.apply(this, [sheet]);
                    }
                })
                .catch(err => {
                    this._failed.set(url, err);
                    if (error) {
                        error.apply(this, [err]);
                    }
                    return sheet;
                });

            this._dict.set(url, sheet );
            return sheet;
        }
    }
}
