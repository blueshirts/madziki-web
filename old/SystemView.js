/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
SystemView.coffee;
define(function(require) {
	let SystemView;
	const vent = require('madziki/common/Vent');
	const Theme = require('madziki/common/Theme');
	const madziki_events = require('madziki/common/Events');

	const MovementView = require('madziki/views/MovementView');

	return (SystemView = class SystemView extends MovementView {
		constructor(...args) {
			{
				// Hack: trick Babel/TypeScript into allowing this before super.
				if (false) { super(); }
				let thisFn = (() => { this; }).toString();
				let thisName = thisFn.slice(thisFn.indexOf('{') + 1, thisFn.indexOf(';')).trim();
				eval(`${thisName} = this;`);
			}
			this.on_context_menu = this.on_context_menu.bind(this);
			super(...args);
		}

		draw_shape(paper) {
			const oval = paper.ellipse(this.midx(), this.midy(), this.width / 2, this.height() / 2);
			oval.attr({stroke: Theme.values('input-border-color')});
			oval.attr({fill: '#222'});
			oval.attr({"stroke-width": this.options["stroke-width"]});

			this.add_shape(oval);
		}

		draw_type(container) {
		}

		get_text(paper, text, x, y) {
			const attr = {
				fill: '#fff',
				"font-family": this.options.text_font,
				"font-size": this.options.text_size
			};

			if (text) { attr.text = text; }
			if (x) { attr.x = x; }
			if (y) { attr.y = y; }
			return paper.text().attr(attr);
		}

		on_draw() {
		}

		on_context_menu(a) {
			if ((a != null) && a.hasClass('view-system')) {
				window.location = `/render/${this.model.get('movement_id')}`;
			} else {
				super.on_context_menu(a);
			}
		}
	});
});
