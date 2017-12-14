/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(function(require) {
	let RenderView;
	const _ = require('underscore');
	const Marionette = require('marionette');
	const marked = require('marked');
	const Promise = require('bluebird');
	const async = require('async');

	const Overlay = require('madziki/utils/Overlay');
	const Messages = require('madziki/utils/Messages');
	const madziki_events = require('madziki/common/Events');
	const vent = require('madziki/common/Vent');
	const router = require('madziki/common/Router');

	const MadzikiService = require('madziki/common/MadzikiService');
	const System = require('madziki/models/System');
	const Movement = require('madziki/models/Movement');
	const Transition = require('madziki/models/Transition');
	const TreeView = require('madziki/views/TreeView');
	const MovementPreviewView = require('madziki/views/MovementPreviewView');
	const EditMovementView = require('madziki/views/EditMovementView');
	const TransitionNewView = require('madziki/views/TransitionNewView');
	const TransitionExistingView = require('madziki/views/TransitionExistingView');

	const templates = require('madziki/templates');


	return RenderView = (function() {
		RenderView = class RenderView extends Marionette.LayoutView {
			static initClass() {
				this.prototype.template = templates['render-layout'];

				this.prototype.regions = {
					dialog_region: '#dialog-region',
					canvas_region: '#canvas-region',
					form_region: '#form-region'
				};
			}

			initialize(options) {
				if (options == null) { options = {}; }
				return {system_id: this.system_id} = options;
			}

			onShow() {
				//
				// Render
				//
				this.listenTo(vent, madziki_events.VIEW_SYSTEM, this.render_system);

				//
				// Movements
				//
				this.listenTo(vent, madziki_events.PREVIEW_MOVEMENT, this.on_preview_movement);
				this.listenTo(vent, madziki_events.EDIT_MOVEMENT, this.on_edit_movement);

				//
				// Transitions
				//
				this.listenTo(vent, madziki_events.PREVIEW_TRANSITION, this.on_preview_transition);
				this.listenTo(vent, madziki_events.EDIT_TRANSITION, params => {
					return window.location.hash = `#movement/${params.child_movement.movement_id}/${params.transition.transition_id}`;
				});
				this.listenTo(vent, madziki_events.DELETE_TRANSITION, this.on_delete_transition);
				this.listenTo(vent, madziki_events.TRANSITION_TO_NEW, this.on_transition_to_new);
				this.listenTo(vent, madziki_events.TRANSITION_TO_EXISTING, this.on_transition_to_existing);

				// Configure the routes.
				router.add_route_event('*default', madziki_events.VIEW_SYSTEM);
				router.add_route_event('movement/:movement_id/:transition_id', madziki_events.EDIT_MOVEMENT);
				router.add_route_event('movement/:movement_id', madziki_events.EDIT_MOVEMENT);
				router.add_route_event('transition/new/:parent_movement_id', madziki_events.TRANSITION_TO_NEW);
				router.add_route_event('transition/new/:parent_movement_id/:parent_transition_id', madziki_events.TRANSITION_TO_NEW);
				router.add_route_event('transition/existing/:parent_movement_id', madziki_events.TRANSITION_TO_EXISTING);
				router.add_route_event('transition/existing/:parent_movement_id/:parent_transition_id', madziki_events.TRANSITION_TO_EXISTING);

				// Start the browser history.
				router.start();

				if (this.$el.parent() == null) {
					this.hide_canvas();
					return this.hide_form();
				}
			}

			//
			// Render the system.
			//
			render_system() {
				Overlay.block();

				return MadzikiService.fetch_system(this.system_id)
					.then(system => {
						this.system = system;

						window.document.title = `${system.get('system').name} - Madziki`;

						this.show_canvas();
						return this.canvas_region.show(new TreeView({
							model: system})
						);
					}).catch(function(err) {
						Messages.display_error('Exception while retrieving system.');
						throw err;}).finally(() => Overlay.unblock());
			}

			//
			// Preview a movement.
			//
			on_preview_movement(params) {
				return this.dialog_region.show(new MovementPreviewView({
						movement: params.movement,
						transition: params.transition,
						movement: params.movement,
						transition: params.transition
					})
				);
			}

			//
			// Edit a movement.
			//
			on_edit_movement(movement_id, transition_id) {
				Overlay.block();

				// Fetch the latest data to render the view.
				const promises = [
					MadzikiService.fetch_movement(movement_id)
				];
				if (transition_id != null) {
					promises.push(MadzikiService.fetch_transition(transition_id));
				}
				return Promise.all(promises)
					.spread((movement, transition) => {
						window.document.title = `${movement.get('name')} - ${this.system.get('system').name} - Madziki`;

						// Display the edit view.
						this.form_region.show(new EditMovementView({
								movement: movement.toJSON(),
								transition: (transition != null) ? transition.toJSON() : undefined
							})
						);
						return this.show_form();
					}).catch(function(err) {
						console.dir(err);
						return window.alert('Exception while loading movements.');}).finally(() => Overlay.unblock());
			}

			//
			// Preview a transition.
			//
			on_preview_transition(params) {
				return this.display_movement_preview({
					movement: params.movement,
					transition: params.transition
				});
			}

			on_delete_transition(transition_id) {
				if (window.confirm('Are you sure you would like to delete the selected transition?')) {
					return new Transition({transition_id}).destroy({
						success: () => {
							this.render_system();
							return window.alert('Successfully deleted transition.');
						},
						error() {
							return Messages.display_error('Error deleting transition.');
						}
					});
				}
			}

			//
			// Transition to a new movement.
			//
			on_transition_to_new(parent_movement_id, parent_transition_id) {
				return this.fetch_model(new Movement({movement_id: parent_movement_id}), (err, model) => {
					this.form_region.show(new TransitionNewView({
							model: new Transition(),
							system_id: this.system_id,
							parent_movement: model.toJSON(),
							parent_transition_id
						})
					);
					return this.show_form();
				});
			}

			//
			// Transition to an existing movement.
			//
			on_transition_to_existing(parent_movement_id, parent_transition_id) {
				const models = [
					new Movement({movement_id: parent_movement_id})
				];
				return this.fetch_models(models, (err, results) => {
					this.form_region.show(new TransitionExistingView({
							model: new Transition(),
							system_id: this.system_id,
							parent_movement: results[0].toJSON(),
							parent_transition_id
						})
					);
					return this.show_form();
				});
			}

			hide_canvas() {
				return this.$(this.canvas_region.el).fadeOut('slow').hide();
			}

			show_canvas() {
				this.hide_form();
				return this.$(this.canvas_region.el).fadeIn('slow').show();
			}

			hide_form() {
				return this.$(this.form_region.el).fadeOut('slow').hide();
			}

			show_form() {
				this.hide_canvas();
				return this.$(this.form_region.el).fadeIn('slow').show();
			}

			//
			// Fetch models in paraellel.
			//
			fetch_models(models, callback) {
				try {
					Overlay.block();

					const tasks = [];
					_.each(models, model => {
						if (model instanceof Backbone.Collection) {
							return tasks.push(callback => this.fetch_collection(collection, callback));
						} else {
							return tasks.push(callback => this.fetch_model(model, callback));
						}
					});
					return async.parallel(tasks, function(err, results) {
						Overlay.unblock();
						return callback(err, results);
					});
				} catch (e) {
					return Overlay.unblock();
				}
			}


			//
			// Fetch a model instance.
			//
			fetch_model(model, callback) {
				return model.fetch({
					success(model) {
						return callback(null, model);
					},
					error() {
						return callback(`Error while retrieving model: ${model.constructor.name}`);
					}
				});
			}

			//
			// Fetch a collection instance.
			//
			fetch_collection(collection, callback) {
				return collection.fetch({
					success(collection) {
						return callback(null, collection);
					},
					error() {
						return callback(`Error while retrieving collection: ${collection.constructor.name}`);
					}
				});
			}
		};
		RenderView.initClass();
		return RenderView;
	})();
});
