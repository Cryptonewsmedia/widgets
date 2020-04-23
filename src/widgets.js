import './scss/widgets.scss';
import ApolloClient from 'apollo-boost';
import { IntrospectionFragmentMatcher } from 'apollo-cache-inmemory';
import { InMemoryCache } from 'apollo-cache-inmemory';
import gql from 'graphql-tag';
import Vue from 'vue';
import VueI18n from 'vue-i18n'
import _ from 'lodash';
import VueGoogleCharts from 'vue-google-charts'

// Запрос схемы с типами
// __schema{
//     types{
//         kind
//         name
//         possibleTypes{
//             name
//         }
//     }
// }



// let fragmentMatcher = new IntrospectionFragmentMatcher({
//     introspectionQueryResultData: {
//         __schema: {
//             types: [
//                 {
//                     kind: 'UNION',
//                     name: 'SearchResultItem',
//                     possibleTypes: [
//                         { name: 'Address' },
//                         { name: 'Currency' }
//                     ],
//                 },
//             ],
//         },
//     },
// });
//
// const cache = new InMemoryCache({ fragmentMatcher });

let Locales = {};

const requireLocale = require.context(
    './locales',
    false,
    /\.json$/
);

requireLocale.keys().forEach(fileName => {
    const name = fileName.match(/\.\/(.*).json$/);
    Locales[name[1]] = requireLocale(fileName);
});

const requireExtensions = require.context(
    './extensions',
    false,
    /\.vue$/
);
requireExtensions.keys().forEach(fileName => {
    const componentConfig = requireExtensions(fileName);
    const componentName = componentConfig.default.name;

    Vue.component(
        componentName,
        componentConfig.default || componentConfig
    )
});

const requireComponents = require.context(
    './components',
    false,
    /\.vue$/
);

let Components = {};
requireComponents.keys().forEach(fileName => {
    const component = requireComponents(fileName);
    const componentName = component.default.name;
    Components[componentName] = component.default || component;
    Vue.component(
        componentName,
        component.default || component
    )
});

VueI18n.prototype.getChoiceIndex = function (choice, choicesLength) {
    if (this.locale !== 'ru') {}
    if (choice === 0) {return 0;}

    const teen = choice > 10 && choice < 20;
    const endsWithOne = choice % 10 === 1;

    if (!teen && endsWithOne) {return 1;}
    if (!teen && choice % 10 >= 2 && choice % 10 <= 4) {return 2;}
    return (choicesLength < 4) ? 2 : 3;
};
Vue.use(VueGoogleCharts);
Vue.use(VueI18n);
const messages = Locales;

let apollo = {};

let currentScriptPath = document.currentScript.src.split('/');
currentScriptPath.pop();

let props = {
    locale: 'en',
    currentScriptPath: currentScriptPath.join('/')+'/',
    widgetsGraphiq: true,
    callbacks: {},
    theme: 'light',
    themes: {
        'light': {
            html_class: '',
            text: '#343a40',
            background: 'transparent'
        },
        'dark': {
            html_class: 'dark',
            text: '#ffffff',
            background: 'transparent'
        }
    }
};

export function init(url, apikey, options = {}){
    options['url'] = url;
    options['apikey'] = apikey;
    props = _.merge(props, options);
    // apollo = new ApolloClient({uri: options['url']});
    return props
}

export function callbacks(cbs = {}){
    props.callbacks = _.merge(props.callbacks, cbs);
    return props.callbacks
}

export function query(query, schema = undefined){

    if (schema){
        let fragmentMatcher = new IntrospectionFragmentMatcher({
            introspectionQueryResultData: {
                __schema: schema,
            },
        });

        let cache = new InMemoryCache({ fragmentMatcher });
        apollo.cache = cache;
        apollo = new ApolloClient({uri: props['url'], cache});
    } else {
        apollo = new ApolloClient({uri: props['url']});
    }

    let properties = {
        is_request: false,
        original: {
            query: query,
            variables: undefined
        },
        query: query,
        gql: gql(query),
        data: {},
        components: [],
        set: function(query){
            properties.query = query;
            properties.gql = gql(query);
            return properties;
        },
        request: function(p = {}, thenResult = function(result, it){}){
        var it = this;
        it.is_request = true;
        let variables = {
            "limit": 10,
            "offset": 0
        };

        it.variables = _.merge(variables, it.variables, p);
        it.original.variables == undefined ? it.original.variables = it.variables : '';

        apollo
            .query({
                query: it['gql'],
                variables: it.variables,
                errorPolicy: 'all',
                fetchPolicy: 'no-cache',
            })
            .then(function(result){
                it.is_request = false;
                it.data = result.data;
                it.errors = Array.isArray(result.errors) && result.errors.length > 0 ? result.errors : [];
                _.each(it.components,function(component){
                    component.render()
                });
                thenResult(result.data, it);
            });
        return this;
    }
    };

    return properties;
}

export function component(name, funcName, selector, query, path, options={},initialOptions={}){
    let properties = {
        name: name,
        funcName: funcName,
        initialOptions: initialOptions,
        options: {
            title: '',
            excludeButtons: []
        },
        selector: selector,
        query: query,
        path: path,
        render: function(){
            var it = this;
            let result_data = typeof options.renderData === 'function' ? options.renderData(_.get(query.data, it.path, query.data)) : _.get(query.data, it.path, query.data);

            if (it.vm == undefined){
                it.vmi18n = new VueI18n({
                    locale: it.locale,
                    fallbackLocale: 'en',
                    messages,
                });
                it.vm = new Vue({
                    el: it.selector,
                    i18n: it.vmi18n,
                    context: it,
                    data: {
                        locale: it.vmi18n.locale,
                        path: it.path,
                        result: result_data,
                        errors: _.get(query.errors, '', query.errors)
                    },
                    render: h => h(Components['base'])
                });
            } else {
                it.vm.locale = it.vmi18n.locale = it.locale;
                it.vm.result = result_data;
                it.vm.errors = _.get(query.errors, '', query.errors);
            }
        }
    };
    properties.options = _.merge(properties.options, options);
    properties = _.merge(properties, props);
    query.components.push(properties);
    return properties;
}

export var lodash = _;

export function table_trades(selector, query, path = 'trades', options ={}){
    let props = {tableOptions: {}, dataOptions: {}};
    props = _.merge(props, options);
    return component('table_trades', 'table_trades', selector, query, path, props);
}

export function chart(selector, query, path = '', options ={}){
    let props = {excludeButtons: ['csv'], chartOptions: {}, dataOptions: {}, chartSettings: {}};
    props = _.merge(props, options);
    return component('chart','chart', selector, query, path, props, options);
}

export function table(selector, query, path = '', options ={}){
    let props = {dataOptions: {}};
    props = _.merge(props, options);
    return component('table_component','table', selector, query, path, props, options);
}

export function text(selector, query, path = '', options ={}){
    let props = {excludeButtons: ['csv'], dataOptions: {}};
    props = _.merge(props, options);
    return component('text_component','text', selector, query, path, props, options);
}

export function list(selector, query, path = '', options ={}){
    let props = {excludeButtons: ['csv'], dataOptions: {}};
    props = _.merge(props, options);
    return component('list_component','list', selector, query, path, props, options);
}

export function pivotTable(selector, query, path = '', options ={}){
    let props = {dataOptions: {}};
    props = _.merge(props, options);
    return component('table_pivot','pivotTable', selector, query, path, props, options);
}

// export function transfers_in_out(selector, query, path = 'address.transfersInOut'){
//     return component('transfers_in_out', selector, query, path);
// }
