
/**
 * Represents a single contact in the email platform
 */
function emailer_contact( contactID, email_address, groups ) {
  // engagement raw data
  this.raw_data = {};
  for(var type in event_rank_values ) {
    this.raw_data[type] = [];
  }
  this.groups = groups;
  // automatically updated every time a new event is added to the contact
  this.champs_score = 0;
  // contact profile information
  // This may be filled to various levels to detail.
  // Top contacts get shallow filled data for the key fields (contacts/search)
  // Clicking on a contact gets the contact filled with more detailed data (contacts/lookup)
  this.profile = {
    email: email_address,
    contactID: contactID
  };
  // UI element (exists regardless of whether it's in the page)
  this.$el = jQuery( jQuery('.templates .contact_template').html() );
  
  /**
   * @param {string} type The name of the event type
   * @param {object} email The raw email data as returned from the API's email/search
   * @param {object} event_data The raw event data as returned from the API
   */
  this.add_email_event = function( type, email, event_data ) {
    var new_item = event_data;
    event_data.in_email = email;
    this.raw_data[ type ].push( new_item );
    this.get_champs_score();
    this.refresh_view();
  };
  
  /**
   * Update and get the champs score for this contact
   * @return {int}
   */
  this.get_champs_score = function() {
    var score = 0;
    for(var type in event_rank_values ) {
      score += ( this.raw_data[type].length * event_rank_values[type] );
    }
    this.champs_score = score;
    return score;
  };
  
  /**
   * Get the contact's detailed record from the Platform.
   * The callback refreshed the contact's view element.
   */
  this.get_profile = function() {
    if( !_.isUndefined(this.profile.custom1) ) return;
    var params = { 
      contactID: this.profile.contactID
    };
    // skip to front of the queue!
    emfl_enqueue_api( 
        'contacts/lookup', 
        params, 
        this.get_profile_callback_success,
        null,
        true,
        true
      );
  };
  
  /**
   * Callback for this.get_profile()
   */
  this.get_profile_callback_success = function( response ) {
    console.log( 'get_profile', response );
    if( response.success == 0 ) {
      console.error( 'fail', this, response );
      // TODO: UI status update
      return;
    }
    this.profile = response.data;
    this.refresh_view();
  };
  
  this.add_group = function( groupID ) {
    // make sure we've got detailed profile
    // update groups in profile object
    // update subscriptions using API
  };
  
  this.refresh_view = function() {
    // template the data
    this.$el.find('.contactID .value').text( this.profile.contactID );
    this.$el.find('.email .value').text( this.profile.email );
    this.$el.find('.champs_score .value').text( this.champs_score );
    var activity = '';
    for( var type in this.raw_data ) {
      activity += '<div class="' + type + '"><span class="value">' + this.raw_data[type].length + '</span> <label>' + type + '</label></div>';
    }
    this.$el.find('.activity').html(activity);
    
    // profile
    if(this.profile.dateAdded) {
      // TODO: variable detailed profile fields if filled
      var url = 'https://emailer.emfluence.com/groups/manageContact.cfm?contactID=' + this.profile.contactID;
      this.$el.find('.name .value').html( '<a href="' + url +'" target="_blank">' + this.profile.firstName + ' ' + this.profile.lastName + '</a>' );
      this.$el.find('.dateAdded .value').text( new Date(this.profile.dateAdded).toLocaleDateString() );
      this.$el.find('.phone .value').text( this.profile.phone );
      
      // detailed fields, which may not exist in shallow-filled profile
      if(this.profile.groupIDs) {
        var groups = [];
        for( var i = 0; i < this.profile.groupIDs.length; i++ ) {
          if( this.groups[ this.profile.groupIDs[i] ] ) groups.push( this.groups[ this.profile.groupIDs[i] ].groupName );
        }
        this.$el.find('.groups .value').html( '<div>' + groups.join('</div><div>') + '</div>' );
      }
      this.$el.addClass('expanded_profile');
    } else this.$el.removeClass('expanded_profile');
  };
  
  this.onclick = function() {
    this.$el.toggleClass('active');
    this.get_profile();
  };
  
  /**
   * Can be called to refresh the listeners.
   * Probably just after insertion into the document.
   * Because there was some bugginess just attaching listeners at initialization.
   */
  this.attach_listeners = function() {
    this.$el.off('click');
    this.$el.on( 'click', '', this.onclick );
  };
  
  _.bindAll( this, 
    'onclick',
    'get_profile_callback_success'
    );
}
