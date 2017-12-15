import React from 'react'
import Navigation from './components/Navigation'
import 'normalize.css'
import 'styles/index.scss'
import Snap from 'snapsvg'

import keyPointsImage from "./images/th-key-points.png"

const defaultWidth = 125
const defaultHeight = 60

const defaultCornerRadius = 3

const defaultFill = '#fff'
const defaultStroke = '#000'
const defaultStrokeWidth = 1

const defaultFont = '"Helvetica Neue", Helvetica, Arial, sans-serif'
const defaultFontSize = 10
const defaultFontColor = '#000'

class ShapeView {
	constructor(options) {
		this.x = options.x ? options.x : 0
		this.y = options.y ? options.y : 0
		this.width = options.width ? options.width : defaultWidth
		this.height = options.height ? options.height : defaultHeight

		this.fill = options.fill ? options.fill : defaultFill
		this.stroke = options.stroke ? options.stroke : defaultStroke
		this.strokeWidth = options.strokeWidth ? options.strokeWidth : defaultStrokeWidth

		this.cornerRadius = options.cornerRadius ? options.cornerRadius : defaultCornerRadius

		this.font = options.font ? options.font : defaultFont
		this.fontSize = options.fontSize ? options.fontSize : defaultFontSize
		this.fontColor = options.fontColor ? options.fontColor : defaultFontColor
		this.text = options.text ? options.text : undefined
		this.type = options.type ? options.type.toLowerCase() : undefined
		this.image = options.image ? options.image : undefined

		this.elements = new Set()
		this.textElements = new Set()

		this.model = options.model ? options.model : {
			name: ''
		}
	}

	render(p) {
		this.renderShape(p)
		if (this.image) {
			this.renderImage(p)
		}
		if (this.text) {
			this.renderText(p)
		}
		if (this.type) {
			this.renderType(p)
		}
	}

	renderShape(p) {
		const options = {
			fill: this.fill,
			stroke: this.stroke,
			'stroke-width': this.strokeWidth,
			r: this.cornerRadius
		}
		const rec = p.rect(this.x, this.y, this.width, this.height).attr(options)
		this.elements.add(rec)
	}

	renderImage(p) {
		const strokeOffset = this.strokeWidth / 2
		const img = p.image(keyPointsImage,
			this.x + strokeOffset,
			this.y + strokeOffset,
			this.width - this.strokeWidth,
			this.height - this.strokeWidth)
		this.elements.add(img)
	}

	renderText(p) {
		const lines = this.getTextLines(this.text)

		if (lines.length === 1) {
			const center = this.getTextCenter(lines[0])
			const the_text = this.getTextElement(p, lines[0], center.x, center.y)
			this.elements.add(the_text)
			this.textElements.add(the_text)
		} else {
			const line1 = lines[0]
			const line1_y = this.midy - (this.height * .08)
			const line1_text = this.getTextElement(p, line1, this.midx, line1_y)
			this.elements.add(line1_text)
			this.textElements.add(line1_text)

			// Calculate the text position for the second line.
			const line2 = lines[1]
			const line2_y = this.midy + (this.height * .12)
			const line2_text = this.getTextElement(p, line2, this.midx, line2_y)
			this.elements.add(line2_text)
			this.textElements.add(line2_text)
		}
	}

	/**
	 * Retrieve the centering point for the supplied text.
	 * @param s - the text string.
	 * @param options - the text attributes.
	 * @returns {{x, y}|*}
	 */
	getTextCenter(s, options = {}) {
		const m = this.textMetrics(s, options)
		return this.getCenter(m)
	}

	/**
	 * Retrieve the centering point for the supplied element.
	 * @param el - the element to center.
	 */
	getCenter(el) {
		if (el instanceof String) {
			// Error
			throw Error(`Parameter el should be of type Object: ${typeof el}`)
		}
		return {
			x: Math.round(this.midx - el.width / 2),
			y: Math.round(this.midy + (el.height / 4))
		}
	}

	renderType(p) {
		// TODO: This should not be hard coded.
		const offsetFromTop = 15
		const text = `<<${this.type}>>`
		const center = this.getTextCenter(text, {
			fontSize: 9
		})
		const el = this.getTextElement(p, text, center.x, offsetFromTop)

		// TODO: This should be an override to the text element.
		el.attr("font-size", 9)

		this.elements.add(el)
		this.textElements.add(el)
	}

	textMetrics(text, options = {}) {
		const paper = Snap(0, 0, 0, 0)
		// TODO: Figure out if this matters.
		// paper.canvas.style.visibility = "hidden"
		options = Object.assign({
				'font-family': this.font,
				'font-size': this.fontSize
			}, options)
		const el = paper.text(0, 0, text).attr(options)
		const bBox = el.getBBox()
		paper.remove()
		return {
			width: bBox.width,
			height: bBox.height
		}
	}

	getTextElement(paper, text, x, y) {
		const attr = {
			// fill: this.fontColor,
			fill: this.fontColor,
			"font-family": this.font,
			"font-size": this.fontSize
		};

		if (text) {
			attr.text = text
		}
		if (x) {
			attr.x = x
		}
		if (y) {
			attr.y = y
		}
		return paper.text().attr(attr)
	}

	getTextLines(text) {
		const lines = []

		if (!text) {
			return lines // **EXIT**
		}

		const text_margin = 15
		const full_line_bbox = this.textMetrics(text)

		// Adjust the size of the text to be slightly wider to ensure that it does not bleed into the shape lines.
		if ((full_line_bbox.width + (text_margin * 2)) > this.width) {

			// The text is wider than the parent shape, wrap the text into multiple lines.
			// Find a break point for the text.
			let words = []
			words = text.split(" ")
			let lineIndex = 0
			let i = 0

			while (i < words.length) {
				const word = words[i]
				if (!lines[lineIndex]) {

					// First word of this line.
					lines[lineIndex] = word
				} else {
					const currentLine = lines[lineIndex] + " " + word

					//log.debug("Current Line: " + currentLine + ", textWidth: " + tm.width + ", width: " + this.width);
					if ((this.textMetrics(currentLine).width + (text_margin * 2)) >= this.width) {

						// Go to the next line.
						lineIndex++
						lines[lineIndex] = word
					} else {

						// Add to the current line.
						lines[lineIndex] = currentLine
					}
				}
				i++
			}
		} else {
			lines[0] = text
		}
		return lines
	}

	get midx() {
		return this.x + (this.width / 2)
	}

	get midy() {
		return this.y + (this.height / 2)
	}
}

class App extends React.Component {
	constructor(props) {
		super()
	}

	componentDidMount() {
		const p = Snap("#canvas")
		const s = new ShapeView({
			x: 5,
			y: 5,
			text: "TH Key Points",
			type: "Submission",
			fill: 'red'
		})
		s.render(p)
	}

	render() {
		return (
			<div className='App'>
				<Navigation/>
				<div>
					<h1>It Works!</h1>
					<p>This React project just works including <span className="redBg">module</span> local styles.</p>
					<p>Enjoy!</p>
				</div>
				<svg id={"canvas"} style={{width: 1600, height: 1200}}>
					This is a canvas!
				</svg>
			</div>
		)
	}
}

export default App
