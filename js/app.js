jQuery(document).ready ( function($){

  // Use mustache-style templating in Underscore
  _.templateSettings = {
    interpolate: /\{\{(.+?)\}\}/g
  };
  
  key_status();
  
});

var class_names = {
  signin_panel: 'signup',
  signin_form: 'signup_form',
  signed_in_panel: 'active_app'
};

var emfl_storage_names = {
  apiKey: 'emfluence_api_key',
  data: 'emfluence_api_retrieved_data', // This is really bad. Need a server-side cache with big storage instead.
  data_apiKey: 'emfluence_cache_api_key' // the API key of the cached data. This is really insecure because we should just use the apiKey value and clear cache on logout.
};

// Each event type gets used as API endpoint.
var event_rank_values_init = {
  views: 5,
  clicks: 20,
  forwards: 20,
  shares: 20
};
// This copy can be modified during app use
var event_rank_values = {
  views: 5,
  clicks: 20,
  forwards: 20,
  shares: 20
};

var managers = {};

/**
 * Initializes/refreshes app status as appropriate.
 * Clears the API queue to prevent call creep.
 * 
 * @param {string}|{null} new_key Optional. 
 * Use it to set a new API key. 
 * Or set to null to remove the active key.
 * 
 * @return {string}|{false}
 */
function key_status( new_key ) {
  // clear the API queue & cache
  emfl_clear_api_queue();
  // allow an active app manager to clean up after itself.
  // Only happens in case of switching accounts, a regular 
  // page refresh wouldn't have the app manager loaded already.
  if(managers.active_app) managers.active_app.destroy();
  // reset rank values
  event_rank_values = jQuery.extend({}, event_rank_values_init);
  // Deal with API key
  // if we log in with a different API key, clear the cached data to make way for new.
  if( (!_.isEmpty( new_key )) && (new_key != localStorage[ emfl_storage_names.data_apiKey ]) ) {
    localStorage.clear(); 
    console.log('clearing all cache!');
  }
  // if logging out, unset the API key
  if( new_key === null ) {
    localStorage.removeItem( emfl_storage_names.apiKey );
  }
  // If logging in, set the API key
  if( new_key ) {
    localStorage[ emfl_storage_names.apiKey ] = localStorage[ emfl_storage_names.data_apiKey ] = new_key;
  }
  
  if( localStorage[ emfl_storage_names.apiKey ] ) {
    // already signed up
    $('body > .' + class_names.signin_panel ).fadeOut().slideUp();
    $('body > .' + class_names.signed_in_panel ).fadeIn();
    managers.active_app = new active_app_manager( 
        $('.' + class_names.signed_in_panel), 
        localStorage[ emfl_storage_names.apiKey ] 
      );
    return localStorage[ emfl_storage_names.apiKey ];
  }
  
  // need to signup
  $('body > .' + class_names.signed_in_panel ).fadeOut();
  $('body > .' + class_names.signin_panel ).fadeIn();
  managers.signup = new signup_manager( 
      $('.' + class_names.signin_form) 
    );
  return false;
}


