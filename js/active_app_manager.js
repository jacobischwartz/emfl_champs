
/**
 * Manages the app in active state. 
 * Instances should be destroyed and re-instantiated for new API keys.
 * @param {Object} active_app_element The jQuery-wrapper active app container element
 */
function active_app_manager( active_app_element, api_key ) {
  
  this.container = active_app_element;
  this.key = api_key;
  
  // Holds the email data
  this.emails = [];
  // Holds the object for each contact, keyed by contactID
  this.contacts = {};
  // Holds the top contacts (those shown on the page), for reference
  this.top_contacts = [];
  // For reference
  this.groups = {};
  // Event types to lookup on each email
  this.event_types = _.keys( event_rank_values );
  // Convenience, for summaries
  this.event_count = 0;
  // Metric controls
  this.controls = {};
  
  this.init = function() {
    //template the app
    var app_template = jQuery('.active_app_template').html();
    this.container.html( app_template );
    
    var display_key = this.key.split('-');
    display_key = display_key.pop();
    this.container.find('.api_key .value').text( display_key );
    this.container.find('.logout').click( this.logout_onclick );
    this.retrieve_key_data();
    
    this.container.find('.settings .metric_values').html();
    for( var event_name in event_rank_values ) {
      this.controls[ event_name ] = new metric_control( event_name );
      this.container.find('.settings .metric_values').append( this.controls[ event_name ].$el );
      this.controls[ event_name ].activate( this.metric_value_onchange );
    }
    
    this.container.find('.settings .exclude_domain input').change( this.show_top_contacts );
    this.container.find('.settings .result_count input').change( this.show_top_contacts );
    this.container.find('.snapshot .create_group').click( this.onclick_create_group );
    this.container.find('.snapshot .print').click( this.onclick_print );
  };
  
  /**
   * Used to clean up at end of use (when switching accounts)
   */
  this.destroy = function() {
    this.container.html('');
    // This really should happen here but it doesn't allow us to log out and back in and keep cache
    //localStorage.clear();
  };
  
  /**
   * Begin the trickle-down data retrieval with all email, end with complete contact compilation
   * Data is limited to last 50 emails for now
   * Called from this.init()
   */
  this.retrieve_key_data = function() {
    // look for stored data so we can skip retrieval
    /*
    if(localStorage[emfl_storage_names.data]) {
      this.emails = localStorage[emfl_storage_names.data].emails;
      this.contacts = localStorage[emfl_storage_names.data].contacts;
      this.show_top_contacts();
      return;
    }*/
    // begin retrieval
    console.log( 'Starting data retrieval at ', new Date() );
    emfl_enqueue_api( 
        'groups/search', 
        { rpp: 50 }, 
        this.groups_search_callback_success, 
        null,
        false,
        true
      );
    var params = { 
      status: 'sent',
      rpp: 50
      };
    emfl_enqueue_api( 
        'emails/search', 
        params, 
        this.email_search_callback_success, 
        null 
      );
    
  };
  
  /**
   * Callback from this.retrieve_key_data()
   */
  this.email_search_callback_success = function( response ) {
    console.log( 'email_search_callback_success', response );
    if( response.success == 0 ) {
      // TODO: display fail status on UI
      console.error('email_search_callback_success failed');
      return false;
    }
    
    // drill down into metrics for each email
    var emails = response.data.records;
    this.emails = emails;
    for( var i = 0;  i < this.emails.length;  i++) {
      this.retrieve_key_data_for_email( this.emails[i] );
    }
    
  };
  
  /**
   * Callback from this.retrieve_key_data()
   */
  this.groups_search_callback_success = function( response ) {
    console.log( 'groups_search_callback_success', response );
    if( response.success == 0 ) {
      // TODO: display fail status on UI
      console.error('groups_search_callback_success failed');
      return false;
    }
    
    // add groups to stored list
    _.each( 
        response.data.records, 
        function( element, index, list ) {
          this.groups[ element.groupID ] = element;
        }, 
        this 
      );
    
    // pick up subsequent pages of groups
    var paging = response.data.paging;
    if( (paging.page == 1) && (paging.totalPages > 1) ) {
      for( var i=2; i <= paging.totalPages; i++ ) {
        emfl_enqueue_api( 
          'groups/search', 
          { rpp: 50, page: i }, 
          this.groups_search_callback_success, 
          null,
          true 
        );
      }
    }
    
  };
  
  /**
   * Trickle-down data retrieval. 
   * A list of emails has already been retrieved, 
   * it's time to get the detailed events data for each email.
   * Called by email_search_callback_success()
   */
  this.retrieve_key_data_for_email = function( email ) {
    console.log('querying for email ', email.emailID);
    email.detail_data = {};
    var metrics = email.metrics;
    var pagesize = 1000;
    for( var i =0; i< this.event_types.length; i++ ) {
      email.detail_data[ this.event_types[i] ] = [];
      // figure out pages needed
      var mymetric_results = metrics[ this.event_types[i] ];
      if(mymetric_results == 0) continue;
      var pages = Math.ceil( mymetric_results / pagesize );
      for( var p = 1; p <= pages; p++ ) {
        this.query_email_event_type( this.event_types[i], email, p );
      }
    }
  };
  
  /**
   * Get some detailed data for an event type (views, clicks, etc) on a particular email.
   * Called by this.retrieve_key_data_for_email()
   * Can be used for subsequent page queries too,
   * when queries have more than the initial page to lookup.
   * 
   * @param {string} type The event type (click, view, etc)
   * @param {object} email A response data element from an email search query
   * @param {int} page (optional, defaults to 1)
   */
  this.query_email_event_type = function( type, email, page ) {
    var params = { 
      rpp: 1000 ,
      page: typeof page !== 'undefined' ? page : 1,
      emailID: email.emailID
    };
    var xx = this;
    emfl_enqueue_api( 
        'emailReports/' + type, 
        params, 
        function( response ) {
          xx.email_events_callback_success( type, response, email );
        },
        null 
      );
  };
  
  /**
   * Callback for an email events queries: clicks | views | forwards | shares
   * @see this.query_email_event_type()
   */
  this.email_events_callback_success = function( type, response, email ) {
    console.log( type, email.emailID, response );
    if( response.success == 0 ) {
      console.error( 'fail', response );
      // TODO: UI status update
      return;
    }
    var records = response.data.records;
    
    // store in-object
    email.detail_data[ type ].push( records );
    
    // update contacts
    for( var i=0; i< records.length; i++ ) {
      this.add_update_contact( type, email, records[i] );
      this.event_count++;
    }
    
    // Update the UI
    this.show_top_contacts();
    this.update_summary();
  };
  
  this.update_summary = function() {
    this.container.find('.email_count .value').text( this.emails.length );
    this.container.find('.contact_count .value').text( this.format_number( _.size(this.contacts) ) );
    this.container.find('.event_count .value').text( this.format_number( this.event_count ) );
  };
  
  this.format_number = function( num ) {
    if(!num) return 0;
    num = '' + num;
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(num)) {
      num = num.replace(rgx, '$1' + ',' + '$2');
    }
    return num;
  };
  
  
  
  // contacts
  
  this.get_contact = function( contactID ) {
    return this.contacts[ contactID ];
  };
  
  /**
   * Add or update a contact with an email event (click, view, etc)
   * @param {string} event_type The event type (click, view, etc)
   * @param {object} email A response data element from an email search query
   * @param {object} raw_event_data A response data element from an email events query
   */
  this.add_update_contact = function( event_type, email, raw_event_data ) {
    var contactID = raw_event_data.contactID;
    var email_address = raw_event_data.email;
    
    // ensure a contact object exists
    var contact = this.get_contact( contactID );
    if(!contact) contact = this.contacts[ contactID ] = new emailer_contact( contactID, email_address, this.groups );
    
    // update the contact with the event
    contact.add_email_event( event_type, email, raw_event_data );
  };
  
  /**
   * Make all contacts recalculate their champs score.
   * Useful when event metric values are changed.
   */
  this.refresh_contacts = function() {
    _.each( this.contacts, function(value, key, list) {
      value.get_champs_score();
      value.refresh_view();
    });
  };
  
  /**
   * Updates the UI for top engaged contacts
   * @param {int} Optional. Number of contacts to show.
   * Defaults to the minimum of 10% or 50 contacts.
   */
  this.show_top_contacts = function( qty ) {
    var $el = this.container.find('.engaged_contacts');
    
    if( _.size(this.contacts) == 0 ) {
      $el.html('No contacts to show yet');
      return;
    }
    
    // remove suppressed contacts
    var contacts = _.reject( this.contacts, function(contact) {
        return contact.profile.suppressed == 1;
      });
      
    // sort by champs score
    var sorted_contacts = _.sortBy( contacts, 'champs_score' );
    
    // apply "excluded domain" option
    var excluded_domain = this.container.find('.settings .exclude_domain input').val().trim();
    if(excluded_domain.length > 0) {
      sorted_contacts = _.reject( sorted_contacts, function(contact) {
        return contact.profile.email.split('@')[1] == excluded_domain;
      });
    }
    
    // finally, limit quantity of results
    var top_size_num = parseInt(this.container.find('.settings .result_count input').val());
    if( top_size_num < 1 ) top_size_num = 50;
    if( !(qty > 0) ) qty = Math.min( top_size_num, 0.1 * sorted_contacts.length );
    var top_contacts = _.last( sorted_contacts, qty );
    
    // update DOM
    $el.html('');
    for(var i = top_contacts.length - 1; i >= 0; i-- ) {
      $el.append( top_contacts[i].$el );
      top_contacts[i].attach_listeners();
    }
    
    // Update data
    this.top_contacts = top_contacts;
    if(!this.in_detail_ensurance_loop) this.ensure_top_contacts_have_profiles();
  };
  
  /**
   * Loops until the API queue is empty, then ensures detailed profiles 
   * for top contacts. Waiting prevents profile requests for contacts 
   * who get bumped from top list during core data retrieval.
   * 
   * DO NOT CALL this if already in loop. 
   * Always test {bool} this.in_detail_ensurance_loop
   */
  this.ensure_top_contacts_have_profiles = function() {
    if( emfl_has_api_queue() ) {
      setTimeout( this.ensure_top_contacts_have_profiles, 300 );
      this.in_detail_ensurance_loop = true;
    } else {
      // prefill top contacts with shallow profile data
      var contactIDs = _.reject( managers.active_app.top_contacts, function(contact) { 
        return !_.isUndefined(contact.profile.dateAdded); 
      });
      contactIDs = _.map( contactIDs, function(contact) { 
        return contact.profile.contactID; 
      });
      for( var i = 0; i < contactIDs.length; i += 50 ) {
        this.get_shallow_profiles( contactIDs.slice( i, i+50 ) );
      }
      this.in_detail_ensurance_loop = false;
    }
  };
  this.in_detail_ensurance_loop = false;
  
  this.get_shallow_profiles = function( contactIDs ) {
    emfl_enqueue_api(
        'contacts/search', 
        { rpp: 50, contactIDs: contactIDs, fields: 'contactID,userID,email,firstName,lastName,suppressed,held,dateAdded,dateModified,phone' }, 
        this.shallow_profiles_callback_success
      );
  };
  
  this.shallow_profiles_callback_success = function(response) {
    console.log( 'shallow_profiles_callback_success', response );
    if( response.success == 0 ) {
      console.error( 'fail', this, response );
      // TODO: UI status update
      return;
    }
    var contact_data = response.data.records;
    // shallow-fill contact profile data if not already filled
    for( var i = 0; i <  contact_data.length; i++ ) {
      if(this.contacts[ contact_data[i].contactID ].profile.dateAdded) continue;
      this.contacts[ contact_data[i].contactID ].profile = contact_data[i];
      this.contacts[ contact_data[i].contactID ].refresh_view();
    }
  };
  
  
  // new group
  
  /**
   * Response to a trigger for greating a group from the top contacts
   */
  this.onclick_create_group = function() {
    if( emfl_has_api_queue() ) return alert("Please wait until API interactions are all done and your champs list has all it's information.");
    if( confirm('Create a new private group with these champions?') ) this.create_new_group();
  };
  
  this.create_new_group = function() {
    var d = new Date();
    var groupName = 'Champs ' + d.toLocaleString();
    var groupDesc = 'This group was created by the Aussie Bobsled Team hackathon app. It contains your champions! They open the most emails, click on the most links. They are hungry. Feed them.';
    emfl_enqueue_api( 
      'groups/save', 
      { groupName: groupName, description: groupDesc }, 
      this.create_group_callback_success, 
      null, 
      true
      );
  };
  
  /**
   * Add contacts to the group, update the contact objects
   */
  this.create_group_callback_success = function(response) {
    console.log(response);
    // TODO: Add contacts to the group, update the contact objects
    if( response.success == 0 ) {
      console.error( 'create_new_group fail', response );
      // TODO: UI status update
      return;
    }
    var groupID = response.data.groupID;
    this.groups[ groupID ] = response.data;
    this.add_contacts_to_group( groupID, this.top_contacts );
    this.add_group_to_contacts( groupID, this.top_contacts );
  };
  
  /**
   * @param {int} groupID
   * @param {array} contacts
   */
  this.add_contacts_to_group = function( groupID, contacts ) {
    var subscribers = _.map( contacts, function(contact) {
      return { email: contact.profile.email };
    });
    console.log( 'Adding ', subscribers, ' to ', groupID );
    emfl_enqueue_api( 
      'contacts/import', 
      { groupIDs: [groupID], contacts: subscribers }, 
      this.add_contacts_to_group_callback_success, 
      null, 
      false
      );
  };
  
  this.add_contacts_to_group_callback_success = function(response) {
    // TODO: unlock the group saver
    if( response.success == 0 ) {
      console.error( 'add_contacts_to_group fail', response );
      window.alert('Could not save new group. Bom-bom.');
      return;
    }
    window.alert('New group created. You can send your champs more emails or surveys, or just refer back to it later.');
  };
  
  this.add_group_to_contacts = function( groupID, contacts ) {
    // Each contact needs to be updated just on our end, to show the right groups consistently
  };
  
  /**
   * Response to a trigger for printing contact sheet
   */
  this.onclick_print = function() {
    if( emfl_has_api_queue() ) return alert("Please wait until API interactions are all done and your champs list has all it's information.");
    window.print();
  };
  
  
  // app-wide
  
  this.logout_onclick = function() {
    key_status( null );
  };
  
  /**
   * Set the value of an event type for champ score calculation
   */
  this.metric_value_onchange = function() {
    console.log('metric value change');
    this.refresh_contacts();
    this.show_top_contacts();
  };
  
  _.bindAll( this, 
    'logout_onclick', 
    'onclick_print',
    'email_search_callback_success', 
    'groups_search_callback_success',
    'email_events_callback_success',
    'onclick_create_group',
    'create_group_callback_success',
    'add_contacts_to_group_callback_success',
    'metric_value_onchange',
    'show_top_contacts',
    'ensure_top_contacts_have_profiles',
    'shallow_profiles_callback_success'
    );
  this.init();
};
