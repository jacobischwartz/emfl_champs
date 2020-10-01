/*
 * Emfluence Javascript API library
 * VERY EARLY stage.
 * Should really be rolled into an instantiable class.
 * 
 * @author Jacob Schwartz @ emfluence
 * @requires jQuery
 */

/**
 * localStorage keys
 */
if(!emfl_storage_names) {
  var emfl_storage_names = {
    apiKey: 'emfluence_api_key',
    data: 'emfluence_api_retrieved_data', // This is bad. Should use a server-side cache with big storage instead.
    data_apiKey: 'emfluence_cache_api_key' // the API key of the cached data. This is really insecure. Change in next version!
  };
}

/**
 * DOM interaction, to show API queue progress
 */ 
if(!emfl_progress_selectors) {
  var emfl_progress_selectors = {
    spinner: '.api_queue_status .progress-indicator',
    value: '.api_queue_status .value'
  };
}

/**
 * Set the API key. 
 * This sets the key in browser localStorage.
 * So beware if you're worried about security!
 */
function emfl_set_api_key( key ) {
  localStorage[ emfl_storage_names.apiKey ] = key;
}

/**
 * Queue an API call.
 * The API Key will automatically be added to the params if not provided.
 * Queues up calls to maximum of 2 per second & non-concurrent.
 * @param {string} action The endpoint
 * @param {object} params The endpoint parameters
 * @param {function} success_callback This function will receive response as param.
 * @param {function} complete_callback This function will receive request object & status as params.
 * @param {bool} urgent Optional. Set TRUE to skip to front of queue
 * @param {bool} nocache Optional. Set TRUE to always call the API
 */
function emfl_enqueue_api( action, params, success_callback, complete_callback, urgent, nocache ) {
  var wrapped_params = {
      action: action,
      params: params,
      success_callback: success_callback,
      complete_callback: complete_callback,
      nocache: nocache
    };
  // if there's a queue, add to the end of it. Otherwise just send.
  if( emfl_api_active ) {
    if(urgent) {
      console.log('URGENT! Beep beep! Coming through!');
      emfl_api_queue.unshift( wrapped_params );
    } else emfl_api_queue.push( wrapped_params );
    console.log('queue addition: ', wrapped_params);
  } else {
    console.log('no queue, direct call for ', wrapped_params );
    emfl_call_api( action, params, success_callback, complete_callback, nocache );
  }
  emfl_api_active = true;
  jQuery(emfl_progress_selectors.spinner).show();
}

/**
 * Directly call the API. Internal.
 * Should only be used from enqueue_api() or api_callback_complete()
 */
function emfl_call_api( action, params, success_callback, complete_callback, nocache ) {
  var url = 'https://api.emailer.emfluence.com/v0/' + action;
  
  // If using a PHP proxy, you might do something like:
  //var url = '/proxy.php';
  //params.url = 'https://api.emailer.emfluence.com/v0/' + action;
  
  if(!params.apiKey) params.apiKey = localStorage[ emfl_storage_names.apiKey ];
  url += '?accessToken=' + params.apiKey; // API Key in URL because of a bug in the platform that was blocking non-URL api key requests
  params = JSON.stringify(params);
  
  // Try local cache first. 
  // It can only hold a limited amount of data but even 5MB less download 
  // time is a fair chunk of performance!
  var cid = emfl_storage_names.data + '/' + action + params;
  if(localStorage[ cid ] && !nocache) {
    setTimeout(function() {
      var response_data = JSON.parse( localStorage[ cid ] );
      console.log( 'returning cached ', response_data, ' for ', cid );
      emfl_api_callback_complete();
      if(complete_callback) complete_callback();
      if(success_callback) success_callback( response_data );
    }, 50);
    return;
  }
  
  // Fall back on actual API call
  jQuery.ajax({
      type: "post",
      dataType: "json",
      contentType: 'application/json',
      crossDomain: true,
      jsonp: false,
      url: url,
      data: params,
      complete: [ emfl_api_callback_complete, complete_callback ],
      success: [ function(response) {
        emfl_api_response_cache( action, params, JSON.stringify(response) );
        }, success_callback ]
    });
}

/**
 * Remove all items from the API queue
 */
function emfl_clear_api_queue() {
  emfl_api_queue = [];
  jQuery(emfl_progress_selectors.value).text('0');
}

/**
 * Conditional tag. Whether there is a queue of API calls.
 * @return {bool}
 */
function emfl_has_api_queue() {
  return emfl_api_queue.length > 0;
}

function emfl_api_response_cache( action, stringified_params, stringified_response ) {
  try {
    localStorage[ emfl_storage_names.data + '/' + action + stringified_params ] = stringified_response;
  } catch( err ) {
    console.log('unable to cache API result: ', err);
  }
}

/**
 * Gets called whenever an API call comes back.
 */
function emfl_api_callback_complete(req, status) {
  if(emfl_api_queue.length > 0) {
    jQuery(emfl_progress_selectors.spinner).show();
  } else jQuery(emfl_progress_selectors.spinner).hide();
  jQuery(emfl_progress_selectors.value).text(emfl_api_queue.length);
  if(emfl_api_queue.length == 0) {
    emfl_api_active = false;
    console.log( 'API queue empty at ', new Date() );
    return;
  }
  // fire the next in the queue
  var next_call = emfl_api_queue.shift();
  console.log('queue shift: ' + emfl_api_queue.length + ' left, calling ', next_call);
  emfl_call_api( 
    next_call.action, 
    next_call.params, 
    next_call.success_callback, 
    next_call.complete_callback,
    next_call.nocache
    );
}

var emfl_api_queue = [];
var emfl_api_active = false;
