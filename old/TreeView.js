/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(function(require) {
	const $ = require('jquery');
	const Marionette = require('marionette');
	const Raphael = require('raphael');
	const bootstrap_contextmenu = require('bootstrap_contextmenu');
	const uuid = require('node_uuid');

	const Overlay = require('madziki/utils/Overlay');
	const madziki_events = require('madziki/common/Events');
	const Resources = require('madziki/utils/Resources');
	const vent = require('madziki/common/Vent');
	const templates = require('madziki/templates');

	const Point = require('madziki/utils/Point');
	const Movement = require('madziki/models/Movement');
	const Transition = require('madziki/models/Transition');

	const MovementView = require('madziki/views/MovementView');
	const TransitionView = require('madziki/views/TransitionView');
	const AggregatorView = require('madziki/views/AggregatorView');
	const MovementViewFactory = require('madziki/views/MovementViewFactory');


	//
	// View to display a tree of movements and transitions.
	//
	class TreeView extends Marionette.LayoutView {
		static initClass() {
			this.prototype.template = templates['tree-layout'];

			this.prototype.regions = {
				container_region: '#container',
				system_context_region: '#system-context-region',
				movement_context_region: '#movement-context-region',
				transition_context_region: '#transition-context-region'
			};

			this.prototype.events =
				{'click': 'on_container_click'};
		}

		initialize(options) {
			if (options == null) { options = {}; }
			this.options = options;

			const view = this;
			view.movement_views = [];
			view.transition_views = [];
			view.minx = 0;
			view.maxx = 0;
			view.miny = 0;
			view.maxy = 0;
			view.transition_map = {};
			view.level_map = {};

		}

		//
		// Add a movement to the model.
		//
		add_movement(movement) {
			return this.model.get('movements')[movement.movement_id] = movement;
		}

		movements() {
			const movement_id = arguments.length > 0 ? arguments[0] : null;
			if (movement_id) {
				console.debug(`Looking up movement with id: ${movement_id}`);
				const result = this.model.get('movements')[movement_id];
				if (!result) {
					console.debug(`Movement not found for id: ${movement_id}`);
				}
				return result;
			} else {
				console.debug('Retrieving all movements...');
				return this.model.get('movements');
			}
		}

		add_transition(transition) {
			return this.model.get('transitions')[transition.transition_id] = transition;
		}

		transitions(transition_id) {
			if (transition_id) {
				return this.options.transitions[transition_id];
			} else {
				return this.options.transitions;
			}
		}

		//
		// TODO: This method should be able to be called more than once.  There is no need to re-created the stage, etc
		// every time a render occurs.  This code should be moved to the initialize method.  Also need to ensure all
		// listeners are cleaned up before rendering again.
		//
		onShow() {
			const is_debug = false;
			const view = this;
			if (this.options == null) {
				console.error("\"options\" is required.");
				return; // **EXIT**
			} else if (this.model == null) {
				console.error("\"model\" is required.");
				return; // **EXIT**
			}

			// Initialize the top level system view.
			const system_id = this.model.get("movement_id");
			const system_model = new Movement(this.model.get('system'));
			system_model.set('level', 0);
			const system_view = MovementViewFactory.find_movement({
				model: system_model,
				x: 0,
				y: 0,
				context_template: this.system_context_region.el
			});
			this.log_movement_view(system_view);

			this.process_movement(system_view);

			// Setup the view after all of the objects have been created.
			this.height = window.innerHeight - $("#navbar").height() - 10;
			this.$el.height(this.height + "px");
			this.width = this.$el.width;
			console.debug(`Found a base view width of: ${this.width}`);
			const min_canvas_width = Math.abs(this.minx) + this.maxx + (Resources.dimensions.HORIZONTAL_MARGIN * 2);
			const min_canvas_height = this.maxy + (Resources.dimensions.VERTICAL_MARGIN * 2);
			console.debug(`Calculated a canvas width of ${min_canvas_width} based on the minimum and maximum diagram values.`);

			// Determine if the canvas width should be that of the screen or bigger in order to accommodate the diagram.
			let width = undefined;
			let height = undefined;
			if (min_canvas_width < this.width) {
				({ width } = this);
			} else {
				width = min_canvas_width;
			}
			if (min_canvas_height < this.height) {
				({ height } = this);
			} else {
				height = min_canvas_height;
			}

			this.paper = Raphael('container', width, height);

			// TODO: This can be improved to center the objects on the screen.
			// TODO: If the shapes are re-drawn they will be in the incorrect position because the offsets will be added
			//       twice unless all objects are laid out again.
			const x_offset = Math.abs(this.minx) + Resources.dimensions.HORIZONTAL_MARGIN;
			const y_offset = Resources.dimensions.VERTICAL_MARGIN;

			console.info(`Calculated offets, x_offset: ${x_offset}, y_offset: ${y_offset}`);

			console.info(`Rendering ${this.movement_views.length} movement views...`);
			for (let movement_view of Array.from(this.movement_views)) {
				movement_view.x_offset(x_offset);
				movement_view.y_offset(y_offset);
				movement_view.render(this.paper);
			}

			console.info(`Rendering ${this.transition_views.length} transition views...`);
			for (let transition_view of Array.from(this.transition_views)) {
				transition_view.x_offset(x_offset);
				transition_view.y_offset(y_offset);
				transition_view.render(this.paper);
			}

			console.debug(`Final canvas dimensions, width: ${width}, ${height}`);
		}


// Offset the center of the diagram based on whether the diagrams shape is lopsided.
//        var center_x_offset;
//        if (width > this.maxx) {
//            center_x_offset = 0;
//        }
//        else {
//            center_x_offset = view.maxx - view.minx;
//            center_x_offset = (-(center_x_offset)) / 2;
//        }
//
//        log.info("Calculated centerXOffset: " + center_x_offset);
//
//        // Determine the width adjustment that should be applied to each movement.
//        var adjustmentSize;
//        if (min_canvas_width < view.width) {
//            log.info("Minimum canvas size is SMALLER than the screen width.");
//            //this.canvasWidth = screenWidth;
//            var canvas_center_x = (view.width / 2) - Math.round(movement_view.width / 1.8);
//            log.info("Calculated canvasCenterX: " + canvas_center_x);
//            canvas_center_x += center_x_offset;
//            adjustmentSize = canvas_center_x;
//        }
//        else {
//            log.info("Minimum canvas size is LARGER than the screen width.");
//            //this.canvasWidth = this.minimumCanvasWidth;
//            var canvas_center_x = (view.width / 2) - (movement_view.width / 2) - Resources.dimensions.HORIZONTAL_MARGIN;
//            log.info("Calculated canvasCenterX: " + canvas_center_x);
//            canvas_center_x += center_x_offset;
//            adjustmentSize = Math.abs(view.minx) + Resources.dimensions.HORIZONTAL_MARGIN;
//        }

//view.main_layer.setOffset(-(Math.abs(view.minx) + Resources.dimensions.HORIZONTAL_MARGIN), -(Resources.dimensions.VERTICAL_MARGIN));

//        view.stage.setWidth(width);
//        view.stage.setHeight(height);
//        view.stage.add(view.main_layer);

		//
		// Recursively process the movement and all of its children.
		//
		process_movement(movement_view, parent_transition_id) {
			let index, name, transition;
			if (movement_view == null) {
				return;
			}

			// TODO: The index values are off when a transition is skipped.

			// Only process the aggregation logic if the view is not currently an aggregator.  If the view is already an
			// aggregator then it has already been processed.
			if (movement_view.model.get('movement_type') !== 'AGGREGATOR') {
				// A map of the aggregates at this level keyed by the transition name.
				const aggregates = {};

				// Find any transitions that have the same name at this level.  If the transitions have the same name then
				// insert an aggregate movement.
				const iterable = movement_view.transitions();
				for (index = 0; index < iterable.length; index++) {
					transition = iterable[index];
					if (aggregates[transition.name] != null) {
						aggregates[transition.name].push(transition);
					} else {
						aggregates[transition.name] = [transition];
					}
				}

				// Process the aggregates.
				for (name in aggregates) {
					const values = aggregates[name];
					if (values.length > 1) {
						// The transition has multiple matches.

						// Remove the transitions from the parent movement that will be aggregated.
						const without_rejected = _.reject(movement_view.transitions(), item => {
							if (item.name === name) { return true; } else { return false; }
						});
						movement_view.transitions(without_rejected);

						// Create a new aggregate movement.
						const aggregate_movement = {
							movement_type: 'AGGREGATOR',
							movement_id: uuid.v4(),
							name,
							transitions: [],
							username: movement_view.model.get('username'),
							level: movement_view.model.get('level') + 1
						};
						this.add_movement(aggregate_movement);

						// Create a transition to the new aggregate.
						const aggregate_transition = {
							transition_id: uuid.v4(),
							name,
							child_movement_id: aggregate_movement.movement_id,
							parent_movement_id: movement_view.model.get('movement_id'),
							parent_transition_id,
							system_id: this.model.get('movement_id')
						};

						// Add the aggregate to the view.
						this.add_transition(aggregate_transition);
						movement_view.transitions().push(aggregate_transition);
						console.log(`Movement view has: ${movement_view.transitions().length} transitions...`);

						// Make the duplicate transitions children of the inserted aggregate movement.
						for (let t of Array.from(values)) {
							t.parent_movement_id = aggregate_movement.movement_id;
							t.parent_transition_id = aggregate_transition.transition_id;
							aggregate_movement.transitions.push(t);
						}
						console.log(`Aggregate movement has: ${aggregate_movement.transitions.length} transitions...`);
					}
				}
			}

			console.debug(`Processing movement: ${movement_view.name()}`);
			console.debug(`Found ${movement_view.transitions().length} transitions for movement: ${movement_view.name()}`);
			const iterable1 = movement_view.transitions();
			for (index = 0; index < iterable1.length; index++) {
				transition = iterable1[index];
				console.info(`Processing transition: ${transition.name}, index: ${index}`);
				console.debug(`parent_transition_id: ${transition.parent_transition_id}`);

				// Determine if this transition is relevant for this branch.

				if (this.is_other_system(movement_view)) {
					console.info(`Skipping transition: ${transition.name} because it belongs to another system: ${movement_view.model.get('name')}`);
					continue; // ** LOOP **

				} else if (transition.parent_transition_id && (transition.parent_transition_id !== parent_transition_id)) {
					// Skip this portion of the tree, it doesn't belong to this branch.
					console.info(`Skipping transition: ${transition.name} because it belongs to another system.`);
					continue; // ** LOOP **

				} else if (transition.system_id && (transition.system_id !== this.model.get('system').movement_id)) {
					console.info(`Skipping transition: ${transition.name} because it is not part of this system.`);
					continue; // ** LOOP **
				}

				const child = this.movements(transition.child_movement_id);
				child.level = movement_view.model.get('level') + 1;
				const child_movement = new Movement(child);
				let child_x = this.calculate_child_x_position(movement_view.x(), index, movement_view.transitions().length);
				const child_y = child_movement.get("level") * (movement_view.height() + Resources.dimensions.VERTICAL_SPACE);
				console.debug(`Calculated initial coordinates - x: ${child_x}, y: ${child_y}`);

				// Determine if the placement of this movement conflicts with it's current right-most sibling.  If there is
				// a conflict then adjust the position of this movement to the right.
				const level_movements = this.level_map[child_movement.get("level")];
				if (level_movements && (level_movements.length > 0)) {
					const right_most_sibling = level_movements[level_movements.length - 1];
					const right_side = right_most_sibling.options.x + right_most_sibling.width;
					if ((right_side + 1) >= child_x) {

						// Adjust the position of current child to the right.
						child_x = right_side + Resources.dimensions.HORIZONTAL_SPACE;
						console.debug(`Found a sibling conflict.  Movement: ${movement_view.name()} overlaps with previous sibling ${right_most_sibling.name()}.  Re-positioning this movement to x: ${child_x}`);
					}
				}

				const child_movement_view = MovementViewFactory.find_movement({
					model: child_movement,
					x: child_x,
					y: child_y,
					parent_transition: transition,
					parent_transition_id,
					context_template: child_movement.get('movement_type') === 'SYSTEM' ? this.system_context_region.el : this.movement_context_region.el
				});

				// Check if there is an existing movement to transition to.
				if (!this.transition_to_previous(movement_view, child_movement_view, transition, index)) {
					this.log_movement_view(child_movement_view);

					// Create a connection between the parent and the child movement.
					const transition_view = new TransitionView({
						model: new Transition(transition),
						width: Resources.dimensions.TRANSITION_WIDTH,
						height: Resources.dimensions.TRANSITION_HEIGHT,
						parent_movement: movement_view.model.toJSON(),
						child_movement: child_movement_view.model.toJSON(),
						context_template: this.transition_context_region.el
					});

					this.calculate_transition_position(index, transition_view, movement_view, child_movement_view, null);
					this.log_transition_view(transition_view);
					this.process_movement(child_movement_view, transition.transition_id);
				}
			}
		}


		//
		// Keep track of the movements level within the hierarchy as well as max width and height of the diagram.
		// @param m - the movement.
		//
		log_movement_view(m) {
			const view = this;

			// Add this view into the list for the current level.
			let level_movements = view.level_map[m.level()];
			if (!level_movements) { view.level_map[m.level()] = (level_movements = []); }

			// Add the child to the list of movements at it's level.
			level_movements.push(m);

			// Keep track of the max dimensions of any of the movements.
			if (m.options.x < view.minx) { view.minx = m.options.x; }
			if ((m.options.x + m.width) > view.maxx) { view.maxx = m.options.x + m.width; }
			if ((m.options.y + m.options.height) > view.maxy) { view.maxy = m.options.y + m.options.height; }

			view.movement_views.push(m);
		}

		log_transition_view(t) {
			const view = this;
			const id = t.transition_id;
			let transitions_for_id = view.transition_map[id];
			if (!transitions_for_id) { view.transition_map[id] = (transitions_for_id = []); }
			transitions_for_id.push(t);
			view.transition_views.push(t);
		}

		is_other_system(movement_view) {
			return (movement_view.model.get("movement_type") === "SYSTEM") && (movement_view.model.get("movement_id") !== this.model.get("system").movement_id);
		}

		//
		// Calculate the x coordinate of the movement given the parent, child index, and the number of children.
		//
		calculate_child_x_position(parent_x, child_index, child_count) {

			// The final X value.
			const view = this;
			let result = undefined;
			console.debug(`parent x: ${parent_x}`);
			console.debug(`child index: ${child_index}`);
			console.debug(`count: ${child_count}`);
			if (child_count === 1) {
				// If there is only a single child then place it directly under the parent.
				//log.info("\t\tchildCount == 1");

				result = parent_x;
			} else if (((child_count % 2) !== 0) && (child_index === Math.round(child_count / 2))) {
				// The item should be positioned directly under the parent.
				//log.info("\t\tPosition the item under == " + parent_x);

				result = parent_x;
			} else if ((child_index + 1) <= (child_count - 1 - child_index)) {

				// The item should be positioned to the left of the parent.
				//log.info("\t\tPosition the item to the left...");

				// Calculate the index from the left.
				const leftIndex = (child_count / 2) - child_index;

				//log.info("\t\tleftIndex: " + leftIndex);
				result = parent_x - (Resources.dimensions.HORIZONTAL_SPACE * (2 * leftIndex));

				// Adjust the result to condense the layout.
				if ((child_count % 2) === 0) { result = result + Resources.dimensions.HORIZONTAL_SPACE; }
			} else {

				// The item should be positioned to the right of the parent.
				//log.info("\t\tPosition the item to the right...");

				// Calculate the index to the right.
				const indexOffset = (child_count / 2) + (child_count % 2);

				//log.info("\t\tindexOffset: " + indexOffset);
				const rightIndex = (child_index + 1) - indexOffset;

				//log.info("\t\trightIndex: " + rightIndex);


				result = parent_x + (Resources.dimensions.HORIZONTAL_SPACE * (2 * rightIndex));

				// Adjust the result to condense the layout.
				if ((child_count % 2) === 0) { result = result - Resources.dimensions.HORIZONTAL_SPACE; }
			}
			console.info(`Calculated X value of: ${result}`);
			return result;
		}


		//
		// Determine the position of the transition data. The transition contains the coordinates of the area that will
		// contain the label for the transition as well as the points of the transition connector.
		//
		// @param index - the index of the child being processed with relation to the parent.
		// @param transition - the transition being processed.
		// @param parent_movement_view - the parent of the child.
		// @param child_movement_view - the child movement.
		// @param existing_child - the existing child to transition to.
		//
		calculate_transition_position(index, transition, parent_movement_view, child_movement_view, existing_child) {
			//console.debug('Calculating transition position for: ' + transition.model.get('name'));
			const view = this;
			const x1 = parent_movement_view.options.x;
			const y1 = parent_movement_view.options.y;
			const x2 = child_movement_view.options.x;
			const y2 = child_movement_view.options.y;
			const midx1 = parent_movement_view.midx();
			const midy1 = parent_movement_view.midy();
			const midx2 = child_movement_view.midx();
			const midy2 = child_movement_view.midy();
			const bottom1 = parent_movement_view.bottom();
			const right2 = child_movement_view.right();

			//console.debug("Calculating transition position: " + transition.model.get('name'));
			//console.debug("parent.x: " + x1 + ", parent.y: " + y1);
			if ((midx1 === midx2) && (index === 0)) {

				// This is the only movement under the parent so there is no drop line.
				transition.options.x = x1;
				transition.options.y = (bottom1 + ((y2 - bottom1) / 2)) - (transition.options.height / 2);
			} else {
				const dropY = bottom1 + Resources.dimensions.DROP_HEIGHT;
				if (existing_child != null) {
					const existing_child_midy = existing_child.y + (existing_child.options.height / 2);
					if (!parent_movement_view.transitions() > 1) {
						transition.options.x = x1;
						transition.options.y = existing_child_midy - ((existing_child_midy - bottom1) / 2) - (Resources.dimensions.TRANSITION_HEIGHT / 2);
					} else {
						transition.options.x = x2;
						transition.options.y = (dropY + ((existing_child_midy - dropY) / 2)) - (Resources.dimensions.TRANSITION_HEIGHT / 2);
					}
				} else {

					// Set the transition label slightly lower to be in line other siblings.
					transition.options.x = x2;
					transition.options.y = (dropY + ((y2 - dropY) / 2)) - (Resources.dimensions.TRANSITION_HEIGHT / 2);
				}
			}

			// Determine the line points.
			const points = [];
			if (existing_child != null) {
				if (!parent_movement_view.transitions() > 0) {

					// There is only a single child.
					points.push(new Point(midx1, bottom1));
					points.push(new Point(midx1, existing_child.midy()));
					points.push(new Point(existing_child.options.x + existing_child.width, existing_child.midy()));
				} else {

					// The existing child is to the left of the parent.
					points.push(new Point(midx1, bottom1));
					points.push(new Point(midx1, bottom1 + Resources.dimensions.DROP_HEIGHT));
					points.push(new Point(midx2, bottom1 + Resources.dimensions.DROP_HEIGHT));
					points.push(new Point(midx2, existing_child.midy()));
					points.push(new Point(existing_child.options.x + existing_child.width, existing_child.midy()));
				}
			} else {
				points.push(new Point(midx1, bottom1));
				points.push(new Point(midx1, bottom1 + Resources.dimensions.DROP_HEIGHT));
				points.push(new Point(midx2, bottom1 + Resources.dimensions.DROP_HEIGHT));
				points.push(new Point(midx2, y2));
			}
			transition.options.points = points;
		}


//log.info("transition.x: " + transition.options.x + ", transition.y: " + transition.options.y);
//_.each(points, function(p) {
//    console.debug('point.x: ' + p.x + ', point.y: ' + p.y);
//});

		/*
		 Determine if the child has already previously been processed. If the child has been previously processed then try
		 and transition to the existing location. Render the child again if it is determined that the transition cannot be
		 cleanly drawn to the previously drawn child.

		 @param parent
		 @param transition
		 @param childIndex
		 */
		transition_to_previous(parent, candidate_child, transition, childIndex) {
			return false;
			const view = this;
			const movement_name = transition.name + "::" + candidate_child.model.get("name");
			const is_debug = true;
			console.info(`Attempting to find previous child instance for movement: ${movement_name}`);
			const previous_movements = _.filter(view.movements, m => (m.model.get("movement_id") === candidate_child.model.get("movement_id")) && (m.level() > parent.level()));
			if (previous_movements.length === 0) {
				console.debug(`No previous movements found for ${candidate_child.model.get("name")}`);
				return false;
			} else {

				// The child already exists on the diagram, determine if it can be transitioned to.  Iterate over the
				// previous instances of the movement and see if a line can be drawn to it without conflict.
				let transition_view;
				if (is_debug) {
					console.debug("Searching previous movements...");
					console.dir(previous_movements);
				}
				let i = 0;

				while (i < previous_movements.length) {
					const previous_child = previous_movements[i];

					// Do not allow transitioning to existing movements that are at the same level or higher in the hierarchy.
					console.debug("Found a previous movement to transition to...");

					// Create a new candidate transition.
					transition_view = new TransitionView({
						model: new Transition(transition),
						width: Resources.dimensions.TRANSITION_WIDTH,
						height: Resources.dimensions.TRANSITION_HEIGHT
					});

					// Determine the transition position details.
					view.calculate_transition_position(childIndex, transition_view, parent, candidate_child, previous_child);
					i++;
				}

				// TODO: Transition to previous validation is busted.
				//                for (var point_index = 0; point_index < connection.options.points.length; point_index++) {
				//                    var p = connection.options.points[point_index];
				//                    var x_objects = view.stage.getIntersection(p);
				//
				//                    if (is_debug) {
				//                        console.log('intersecting objects...');
				//                        console.dir(x_objects);
				//                    }
				//
				//                    if (!x_objects || x_objects.length == 0) {
				//                        if (is_debug) {
				//                            console.debug('Didn\'t find any intersecting objects...');
				//                        }
				//                        continue;
				//                    }
				//                    else {
				//                        if (is_debug) {
				//                            console.debug('Found intersection conflict with object...');
				//                            console.dir(x_objects);
				//                        }
				//                        return false;
				//                    }
				//                }
				console.debug("Did not find any conflicts, transitioning to previous movement...");

				//console.dir(transition.options.points);
				view.log_transition_view(transition_view);
				return true;
			}
		}


//                _.each(view.transition_map, function(previous_transitions, previous_transition_id, list) {
//                    // See if the current transition will intersect with any of the previous transitions.
//                    // Ignore any transitions to the previous child movement because we are sure to intersect
//                    // those.
//                    for (var prev_trans_index = 0; i < previous_transitions; prev_trans_index++) {
//                        var previous_transition = previous_transitions[prev_trans_index];
//
//                        if (candidateChild.model.get('id') == previous_transition.model.get('child_movement_id')) {
//                            // Ignore the child when looking for conflicts.  i.e. cannot conflict with itself.
//                            continue; // **LOOP**
//                        }
//                        else if (connection.intersects(previousTransition)) {
//                            // Found a conflict
//                            //log.info("Found a transition conflict while attempting to transition to "
//                            //    + "existing movement: " + previousChild.getName() + ", conflicting"
//                            //    + " transition: " + previousTransition.getName());
//                            return false; // **EXIT**
//                        }
//                    }
//                });

//                // TODO: The intersect check is not working with movements.
//                for (List<JSONMovement> previousMovements : this.movements.values()) {
//                    for (JSONMovement previousMovement : previousMovements) {
//                        if (previousMovement.getLevel() <= parent.getLevel()) {
//                            // The movement is above the child so it should not conflict.
//                            continue; // **LOOP**
//                        }
//                        else if (previousMovement.getId().equals(previousChild.getId())) {
//                            // Ignore the movement we are trying to transition to, i.e. can't conflict with
//                            // itself.
//                            continue; // **LOOP**
//                        }
//                        else if (jt.intersects(previousMovement)) {
//                            // Found a conflict with a movement.
//                            if (isLog) {
//                                log.info("Found a movement conflict while attempting to transition to existing "
//                                    + "movement: " + previousChild.getName() + ", conflicting movement: "
//                                    + previousMovement.getName());
//                            }
//                            return false; // **EXIT**
//                        }
//                    }
//                }
//
//view.log_transition_view(connection);

//return true; // **EXIT**

//    edit_movement: ->
//      view = this
//      window.location.href = _.sprintf("/movement/%s/system/%s", view.selected_movement.model.get("movement_id"),
//        view.model.get("movement_id"))  if view.selected_movement
//      return

//    add_transition: ->
//      view = this
//      if view.selected_movement
//        url = _.sprintf("/movement/%s/transition?system_id=%s", view.selected_movement.model.get("movement_id"),
//          view.model.get("movement_id"))
//        url += "&parent_transition_id=" + view.selected_movement.parent_transition_id()  if view.selected_movement.parent_transition_id()
//        window.location.href = url
//      return

		//
		// Handle the clicking of the canvas.
		//
		on_container_click() {
		}
	}
	TreeView.initClass();

	return TreeView;
});
