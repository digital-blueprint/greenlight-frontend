export default {
    local: {
        basePath: '/dist/',
        entryPointURL: 'https://api-dev.tugraz.at',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'auth-dev-mw-frontend-local',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'http://localhost:8081',
        nextcloudName: 'TU Graz cloud',
        preselectedOption: 'TU Graz',
        gpSearchSelfTestStringArray: 'https://selbsttest.stmk.gv.at/public-result?id=,https://selbsttest.ktn.gv.at/public-result?id=',
    },
    bs: {
        basePath: '/dist/',
        entryPointURL: 'http://bs-local.com:8000',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'auth-dev-mw-frontend-local',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'http://bs-local.com:8081',
        nextcloudName: 'TU Graz cloud',
        preselectedOption: 'TU Graz',
        gpSearchSelfTestStringArray: 'https://selbsttest.stmk.gv.at/public-result?id=,https://selbsttest.ktn.gv.at/public-result?id=',
    },
    development: {
        basePath: '/apps/greenlight/',
        entryPointURL: 'https://api-dev.tugraz.at',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'dbp-greenlight',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'https://nc-dev.tugraz.at/pers',
        nextcloudName: 'TU Graz cloud',
        preselectedOption: 'TU Graz',
        gpSearchSelfTestStringArray: 'https://selbsttest.stmk.gv.at/public-result?id=,https://selbsttest.ktn.gv.at/public-result?id=',
    },
    demo: {
        basePath: '/apps/greenlight/',
        entryPointURL: 'https://api-demo.tugraz.at',
        keyCloakBaseURL: 'https://auth-demo.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'dbp-greenlight',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'https://cloud.tugraz.at',
        nextcloudName: 'TU Graz cloud',
        preselectedOption: 'TU Graz',
        gpSearchSelfTestStringArray: 'https://selbsttest.stmk.gv.at/public-result?id=,https://selbsttest.ktn.gv.at/public-result?id=',
    },
    production: {
        basePath: '/',
        entryPointURL: 'https://api.tugraz.at',
        keyCloakBaseURL: 'https://auth.tugraz.at/auth',
        keyCloakRealm: 'tugraz',
        keyCloakClientId: 'greenlight_tugraz_at-GREENLIGHT',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 167,
        nextcloudBaseURL: 'https://cloud.tugraz.at',
        nextcloudName: 'TU Graz cloud',
        preselectedOption: 'TU Graz',
        gpSearchSelfTestStringArray: 'https://selbsttest.stmk.gv.at/public-result?id=,https://selbsttest.ktn.gv.at/public-result?id=',
    },
};