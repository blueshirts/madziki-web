define (require) ->
  Marionette = require 'marionette'
  Raphael = require 'raphael'

  vent = require 'madziki/common/Vent'
  Theme = require 'madziki/common/Theme'
  madziki_events = require 'madziki/common/Events'
  Resources = require 'madziki/utils/Resources'

  #
  # Base view for shape objects.
  #
  class ShapeView extends Marionette.ItemView
    template: false

    initialize: (options = {}) ->
      @options = options

      # Configure options.
      {
        @width
        @context_template
        @hover
      } = options

      # Configure defaults.
      unless @width?
        @width = Resources.dimensions.SHAPE_WIDTH

      unless @hover?
        @hover = true

      unless options.height?
        options.height = Resources.dimensions.SHAPE_HEIGHT

      unless options.text_font?
        options.text_font = '"Helvetica Neue", Helvetica, Arial, sans-serif'
      unless options.text_align?
        options.text_align = 'center'
      unless options.text_color?
        options.text_color = Theme.values 'body-background-color'
      unless options.text_style?
        options.text_style = 'normal'
      unless options.text_size?
        options.text_size = 11

      unless options.fill?
        options.fill = Theme.values 'body-background-color'
      unless options.stroke?
        options.stroke = Theme.values 'input-border-color'
      unless options['stroke-width']?
        options['stroke-width'] = 2
      unless options.corner_radius?
        options.corner_radius = 3

      unless options.selected?
        options.selected = false
      unless options.selected_line_width?
        options.selected_line_width = 3
      unless options.selected_stroke?
        options.selected_stroke = Theme.values 'button-success-background-color'

      @options.x_offset = 0
      @options.y_offset = 0

    trigger_click: (ev) ->
      @trigger madziki_events.SHAPE_CLICK,
        event: ev
        view: @
      vent.trigger madziki_events.SHAPE_CLICK,
        event: ev
        view: @

    trigger_rclick: (ev) ->
      @trigger madziki_events.SHAPE_RCLICK,
        event: ev
        view: @
      vent.trigger madziki_events.SHAPE_RCLICK,
        event: ev
        view: @

    trigger_mouseover: (ev) ->
      @trigger madziki_events.SHAPE_MOUSEOVER,
        event: ev
        view: @
      vent.trigger madziki_events.SHAPE_MOUSEOVER,
        event: ev
        view:@

    trigger_mouseout: (ev) ->
      @trigger madziki_events.SHAPE_MOUSEOUT,
        event: ev
        view: @
      vent.trigger madziki_events.SHAPE_MOUSEOUT,
        event: ev
        view: @


    render: (paper) ->
      # Keep track of the entire set of SVG objects.
      @objects_set = paper.set()
      # Keep track of SVG shapes that should be highlighted.
      @shapes_set = paper.set()
      # Keep track of SVG text.
      @text_set = paper.set()

      if @on_before_draw?
        @on_before_draw()

      # Draw the artifacts.
      @draw_shape paper
      @draw_text paper
      @draw_type paper
      @configure_context_menu()

      if @on_draw?
        @on_draw()

      if @hover
        # Mouse over listener.
        on_mouse_over = (ev) =>
          @trigger_mouseover(ev)
          @shapes_set.attr
            'stroke': @options.selected_stroke

          # Ensure the object and its parts are in the forefront.
          @toFront()
        # Mouse out listener.
        on_mouse_out = (ev) =>
          @trigger_mouseout(ev)
          @shapes_set.attr
            'stroke': @options.stroke
        # Listen to hover events.
        @objects_set.hover on_mouse_over, on_mouse_out
        # Listen to click events.
        @objects_set.click (ev) =>
          @trigger_click(ev)
          false
        # Listen to right click events.
        #@objects_set.mousedown (ev) =>
        #if ev.which == 3
        #@trigger_rclick(ev)
        #false

        # Adjust the pointer when moused over.
        for item in @objects_set
          $item = $(item.node)
          $item.css 'cursor', 'pointer'
      return

    draw_shape: (paper) ->
      rec = paper.rect(@x(), @y(), @width, @height()).attr(
        fill: @options.fill
        stroke: @options.stroke
        "stroke-width": @options["stroke-width"]
        r: @options.corner_radius
      )

      @add_shape(rec)
      return

    get_text_lines: (text) ->
      lines = []

      unless text
        return lines # **EXIT**

      text_margin = 15
      full_line_bbox = @get_text_metrics(text)

      # Adjust the size of the text to be slightly wider to ensure that it does not bleed into the shape lines.
      if full_line_bbox.width + (text_margin * 2) > @width

        # The text is wider than the parent shape, wrap the text into multiple lines.
        # Find a break point for the text.
        words = []
        words = text.split(" ")
        lineIndex = 0
        i = 0

        while i < words.length
          word = words[i]
          unless lines[lineIndex]

            # First word of this line.
            lines[lineIndex] = word
          else
            currentLine = lines[lineIndex] + " " + word

            #log.debug("Current Line: " + currentLine + ", textWidth: " + tm.width + ", width: " + this.width);
            if @get_text_metrics(currentLine).width + (text_margin * 2) >= @width

              # Go to the next line.
              lineIndex++
              lines[lineIndex] = word
            else

              # Add to the current line.
              lines[lineIndex] = currentLine
          i++
      else
        lines[0] = text
      lines

    draw_text: (paper) ->
      lines = @getTextLines(@model.get("name"))
      if lines.length is 1
        the_text = @get_text(paper, lines[0], @midx(), @midy())
        @add_text the_text
      else
        line1 = lines[0]
        line1_y = @midy() - (@height() * .08)
        line1_text = @get_text(paper, line1, @midx(), line1_y)
        @add_text line1_text

        # Calculate the text position for the second line.
        line2 = lines[1]
        line2_y = @midy() + (@height() * .12)
        line2_text = @get_text(paper, line2, @midx(), line2_y)
        @add_text line2_text
      return

    draw_type: (paper) ->
      type = @model.get("movement_type")
      unless type

        # No type defined.
        return # **EXIT**
      else
        type = _.capitalize(type.toLowerCase())
      offsetFromTop = 10
      type_text = @get_text(paper, "<<" + type + ">>", @midx(), @y() + offsetFromTop)
      type_text.attr "font-size", 10

      @add_text type_text
      return

    #
    # Move the objects associated with this view to the front.
    #
    toFront: ->
      @shapes_set.toFront()
      @objects_set.toFront()

    #
    # Move the objects associated with this view to the back.
    #
    toBack: ->
      @objects_set.toBack()
      @shapes_set.toBack()

    #
    # Configure the context menu.
    #
    configure_context_menu: ->
      if @context_template?
        for object in @objects_set
          $(object.node).contextmenu
            target: @context_template
            onItem: (el, ev) =>
              if @on_context_menu?
                target = $(ev.target)
                link = target.closest('a')
                @on_context_menu link

    name: ->
      @model.get "name"

    level: ->
      @model.get "level"

    parent_transition_id: ->
      @options.parent_transition_id

    transitions: ->
      if arguments.length > 0
        @model.set 'transitions', arguments[0]
      else
        @model.get 'transitions'

    height: ->
      @options.height

    x: (value) ->
      if value
        @options.x = value
      @options.x + @options.x_offset

    y: (value) ->
      if value
        @options.y = value
      @options.y + @options.y_offset

    x_offset: (value) ->
      if value
        @options.x_offset = value
      @options.x_offset

    y_offset: (value) ->
      if value
        @options.y_offset = value
      @options.y_offset

    midx: ->
      @x() + (@width / 2)

    midy: ->
      @y() + (@options.height / 2)

    right: ->
      @x() + @width

    bottom: ->
      @y() + @options.height

    get_text: (paper, text, x, y) ->
      attr =
        fill: @options.text_color
        "font-family": @options.text_font
        "font-size": @options.text_size

      attr.text = text  if text
      attr.x = x  if x
      attr.y = y  if y
      paper.text().attr attr

    get_objects: ->
      return @objects_set

    get_text_objects: ->
      return @text_set

    get_text_metrics: (text) ->
      paper = Raphael(0, 0, 0, 0)
      paper.canvas.style.visibility = "hidden"
      el = paper.text(0, 0, text)
      el.attr "font-family", @text_font
      el.attr "font-size", @text_size
      bBox = el.getBBox()
      paper.remove()
      width: bBox.width
      height: bBox.height

    onDestroy: ->
      @undelegateEvents()

      @objects_set.remove()
      @shapes_set.remove()
      @text_set.remove()
      return

    first_shape: ->
      if @objects_set and @objects_set.length > 0
        return @objects_set[0]
      else
        return undefined

    #
    # Add an object.  Object are clickable.
    #
    add_object: (object) ->
      @objects_set.push object

    #
    # Add a shape.  Shapes are clickable and highlighted on hover.
    #
    add_shape: (shape) ->
      @objects_set.push shape
      @shapes_set.push shape

    #
    # Add text.
    #
    add_text: (text) ->
      @objects_set.push text
      @text_set.push text

  return ShapeView
