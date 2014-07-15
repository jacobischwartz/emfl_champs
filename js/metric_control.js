
/**
 * @param {string} metric_name
 */
function metric_control( metric_name ) {
  
  this.metric_name = metric_name;

  var option_template = '<div class="metric_control">';
  option_template += '<label>' + metric_name + '</label>';
  option_template += '<select>';
  for( var i = 1; i < 31; i++ ) option_template += '<option>' + i + '</option>';
  option_template += '</select></div>';
  
  this.$el = jQuery(option_template);
  this.$el.find('select').val( event_rank_values[ metric_name ] );
  
  /**
   * Use after inserting this.$el into the DOM
   * @param {function} change_hook Function to call when change is made
   */
  this.activate = function( change_hook ) {
    this.$el.find('select').change( this.onchange );
    this.$el.find('select').change( change_hook );
  };
  
  this.onchange = function() {
    event_rank_values[ this.metric_name ] = parseInt(this.$el.find('select').val());
    console.log( this.metric_name, ' value changed to ', event_rank_values[ this.metric_name ] );
  };
  
  this.destroy = function() {
    this.$el.remove();
    this.$el = null;
  };
  
  _.bindAll( this, 'onchange' );
  
}
