/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

Permission = function(action, resource_type, context_id) {
  return {
    action: action,
    resource_type: resource_type,
    context_id: context_id
  };
};

$.extend(Permission, (function() {
  var _permission_match, _is_allowed, _admin_permission_for_context
    , ADMIN_PERMISSION = new Permission('__GGRC_ADMIN__', '__GGRC_ALL__', 0)
    ;

  _admin_permission_for_context = function(context_id) {
    return new Permission(
      ADMIN_PERMISSION.action, ADMIN_PERMISSION.resource_type, context_id);
  };

  _permission_match = function(permissions, permission) {
    var resource_types = permissions[permission.action] || {}
      , resource_type = resource_types[permission.resource_type] || {}
      , contexts = resource_type['contexts'] || []
      ;

    return (contexts.indexOf(permission.context_id) > -1);
  };

  _is_allowed = function(permissions, permission) {
    if (!permissions)
      return false; //?
    // Prohibit all activity on profile pages
    if (GGRC.page_instance() instanceof CMS.Models.Person && permission.action !== 'read' && !/dashboard/.test(window.location))
      return false;

    // Prohibit audit editing for "Mapped in Audits"
    if (permission.resource_type && permission.resource_type.match(/(Request|Response)/) && permission.action !== 'read' 
        && !GGRC.page_instance().constructor.shortName.match(/(Audit|Program|Person)/)) {
      return false;
    }

    if (_permission_match(permissions, permission))
      return true;
    if (_permission_match(permissions, ADMIN_PERMISSION))
      return true;
    if (_permission_match(permissions,
          _admin_permission_for_context(permission.context_id)))
      return true;
    // Check for System Admin permission
    if (_permission_match(permissions,
          _admin_permission_for_context(0)))
      return true;
    return false;
  };

  _resolve_permission_variable = function (value) {
    if ($.type(value) == 'string') {
      if (value[0] == '$') {
        if (value == '$current_user') {
          return GGRC.current_user;
        }
        throw new Error('unknown permission variable: ' + value);
      }
    }
    return value;
  };

  _CONDITIONS_MAP = {
    contains: function(instance, args) {
      var value = _resolve_permission_variable(args.value);
      var list_value = instance[args.list_property];
      for (var i = 0; i < list_value.length; i++) {
        if (list_value[i].id == value.id) return true;
      }
      return false;
    }
    , is: function(instance, args) {
      var value = _resolve_permission_variable(args.value);
      var property_value = instance[args.property_name];
      return value == property_value;
    }
    , in: function(instance, args) {
      var value = _resolve_permission_variable(args.value);
      var property_value = instance[args.property_name];
      return value.indexOf(property_value) >= 0;
    }
  };

  _is_allowed_for = function(permissions, instance, action) {
    var action_obj = permissions[action] || {}
      , instance_type =
          instance.constructor ? instance.constructor.shortName : instance.type
      , type_obj = action_obj[instance_type] || {}
      , conditions_by_context = type_obj['conditions'] || {}
      , context = instance.context || {id: null}
      , conditions = conditions_by_context[context.id] || [];
    if (conditions.length == 0) return true;
    for (var i = 0; i < conditions.length; i++) {
      var condition = conditions[i];
      if (_CONDITIONS_MAP[condition.condition](instance, condition.terms)) {
        return true;
      }
    }
    return false;
  };

  is_allowed = function(action, resource_type, context_id) {
    return _is_allowed(
        GGRC.permissions, new Permission(action, resource_type, context_id));
  };

  is_allowed_for = function(action, resource) {
    return _is_allowed_for(GGRC.permissions, resource, action);
  };

  is_allowed_any = function(action, resource_type) {
    var allowed = is_allowed(action, resource_type);
    if (!allowed) {
      allowed = GGRC.permissions[action] && GGRC.permissions[action][resource_type] && GGRC.permissions[action][resource_type].contexts.length;
    }
    return !!allowed;
  };

  return {
      _is_allowed: _is_allowed
    , is_allowed: is_allowed
    , is_allowed_for: is_allowed_for
    , is_allowed_any: is_allowed_any
    , page_context_id: function() {
        var page_instance = GGRC.page_instance();
        return (page_instance && page_instance.context && page_instance.context.id) || null;
      }
  };
})());
