
/**
 * 
 * @param {Object} form_element The jQuery-wrapped signup form element
 */
function signup_manager( form_element ) {
  
  
  // Variables
  
  // jQuery-wrapped form element
  this.form_el = form_element;
  
  // Used to make sure we don't submit during a validation attempt
  this.validation_lock = false;
  
  
  
  // Methods
  
  this.init = function() {
    this.form_el.on( 'submit', this.onsubmit );
    this.display_message('');
    this.form_el.find('#api_key_input').val('').focus();
  };
  
  /**
   * Display messaging
   * @param {html} The message to display to the user
   */
  this.display_message = function( msg ) {
    this.form_el.find('.messaging').html( msg );
  };
  
  /**
   * AJAX lock
   */
  this.activate_validation_lock = function() {
    this.validation_lock = true;
    this.form_el.find('input').attr('disabled','disabled');
  };
  
  /**
   * AJAX lock
   */
  this.deactivate_validation_lock = function() {
    this.validation_lock = false;
    this.form_el.find('input').removeAttr('disabled');
  };
  
  /**
   * Perform initial format validation 
   * then trigger an AJAX validation with the API
   */
  this.validate_key = function( key ) {
    key = key.replace(/ /g, '');
    
    if( key.length != 36 ) {
      // display a 'bad format' error
      this.display_message('Bad key format.');
      return false;
    }
    
    //validate the key with the API
    this.activate_validation_lock();
    this.display_message('Checking with the API');
    emfl_enqueue_api( 
        'helper/ping', 
        { apiKey: key }, 
        this.onresponsesuccess,
        this.onresponsecomplete,
        true
      );
  };

  /**
   * We're done with the signup form
   */  
  this.activate_app = function( key ) {
    key_status( key );
  };
  
  
  
  // Callbacks
  
  /**
   * Form submit handler
   */
  this.onsubmit = function() {
    if( this.validation_lock ) return false;
    var api_key = this.form_el.find('#api_key_input').val();
    this.validate_key( api_key );
    return false;
  };
  
  /**
   * Validation AJAX callback
   */
  this.onresponsesuccess = function( response ) {
    var is_valid = false;
    
    // parse response
    if(response.success == 1) is_valid = true;
    
    if( is_valid ) {
      // respond to valid key
      var key = this.form_el.find('#api_key_input').val();
      this.display_message('Key validated.');
      this.activate_app( key );
      return;
    }
    
    // respond to invalid key
    this.display_message('Key not valid. Try again.');
  };
  
  /**
   * Validation AJAX callback
   */
  this.onresponsecomplete = function( req, status ) {
    this.deactivate_validation_lock();
    
    // if it's a success, we already took action
    if( status == 'success' ) return;
    
    // it's an error!
    this.display_message('App error! Eek! Please try again later.');
    console.log( 'valiation complete error', req, status);
  };
  
  _.bindAll( this, 'onsubmit', 'onresponsesuccess', 'onresponsecomplete' );
  this.init();
}
