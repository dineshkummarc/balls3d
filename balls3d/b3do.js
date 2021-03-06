/*
(c) 2010 Katalabs, Inc.
All Rights Reserved

b3d o3d wrapper

*/

o3djs.require('o3djs.util');
o3djs.require('o3djs.math')
o3djs.require('o3djs.rendergraph')
o3djs.require('o3djs.primitives')
o3djs.require('o3djs.material')
o3djs.require('o3djs.quaternions')

var b3do = b3do || {};

// global variables
var g_o3dElement
var g_client
var g_o3d
var g_math
var g_pack
var g_viewInfo
var g_eyePosition = [0, 3, 20]
var g_target = [0, 3, 19]
var g_camAngleY = 0

///	turn an 'ori' parameter into a quaternion
/// it might be one already, or else it's an [axis,degree]
b3do.ori2quat = function (ori) {
	if (ori.length==4) return ori
	return o3djs.quaternions.axisRotation(ori[0],ori[1]*0.0174532925)
}

// move camera in direction it's looking
b3do.moveCamera = function (d) {
	var dx=Math.sin(g_camAngleY)
	var dz=Math.cos(g_camAngleY)
	g_eyePosition[0] -= dx*d
	g_eyePosition[2] -= dz*d
	b3do.setCamera()
}

// move camera in direction perpendicular to where it's looking
b3do.slideCamera = function (d) {
	var dx=Math.sin(g_camAngleY+Math.PI*.5)
	var dz=Math.cos(g_camAngleY+Math.PI*.5)
	g_eyePosition[0] -= dx*d
	g_eyePosition[2] -= dz*d
	b3do.setCamera()
}

// pan camera about Y (up) axis
b3do.turnCamera = function (d) {
	g_camAngleY += d
	b3do.setCamera()
}

// raise/lower camera
b3do.raiseCamera = function (d) {
	g_eyePosition[1] += d
	g_target[1] += d
	b3do.setCamera()
}

// compute camera target as offset from eye position given camera angle, and set view
b3do.setCamera = function () {
	var dx=Math.sin(g_camAngleY)
	var dz=Math.cos(g_camAngleY)
	g_target = g_eyePosition.slice()
	g_target[0] -= dx
	g_target[2] -= dz
    g_viewInfo.drawContext.view = g_math.matrix4.lookAt(
            g_eyePosition,     // eye
            g_target,        // target
            [0, 1, 0])    // up
	debug("ang: " + g_camAngleY + " eye: " + g_eyePosition + " targ: " + g_target, 0)
}

/// right now I'm doing this stupidly as I don't really get prototype inheritance

b3do.world = function(gravity, timestep, ground){
	// Init global variables.
	this.running = false
	debug("g_pack: " + g_pack)
	this.pack = g_pack
	
	this.world = new b3d.world(gravity, timestep, ground)

	///	create a gound plane	
	var groundplane = o3djs.primitives.createPlane(
		this.pack, 
		o3djs.material.createBasicMaterial(this.pack, window.g_viewInfo, [.45, .9, .9, 1]), 
		10, // width
		10, // depth
 		1, // Number of meridians.
 		1)
	transform = this.pack.createObject('Transform')
	transform.addShape(groundplane)
	transform.translate([0,ground,0])
	transform.parent = g_client.root;

	this.start = function () {this.running = true}
	this.pause = function () {this.running = false}
	this.is_running = function () {return this.running}
	
	this.addDBall = function(size, pos, ori, nom, shape, bounce){
		///	if no o3d primitive specified, create one:
		this.world.addDBall(size, pos, b3do.ori2quat(ori), nom, bounce)
		ball = this.world.dynamics[this.world.dynamics.length - 1] ///	get the ball we just made
		if (shape == undefined) {
			debug("g_viewInfo: " + window.g_viewInfo, 4)
			this.shape = o3djs.primitives.createSphere(
				this.pack, 
				o3djs.material.createBasicMaterial(this.pack, window.g_viewInfo, 
				[1, 0, 0, 1]), 
				size, // Radius of the sphere.
 				30, // Number of meridians.
 				20)
		}
		ball.o3d_transform = this.pack.createObject('Transform')
		ball.o3d_transform.addShape(this.shape)
		ball.o3d_transform.translate(pos)
		///	need to do rotation
		ball.o3d_transform.parent = g_client.root;
		return ball
	}

	this.addSBox = function(size, pos, ori, nom, shape, bounce){
		ori = b3do.ori2quat(ori)
		this.world.addSBox(size, pos, ori, nom, bounce)
		box = this.world.statics[this.world.statics.length - 1]
		debug("addSBox: "+box)
		if (shape == undefined) {
			this.shape = o3djs.primitives.createBox(this.pack, o3djs.material.createBasicMaterial(this.pack, window.g_viewInfo, [0, 1, 0, 1]), size[0], size[1], size[2])
		}
		box.o3d_transform = this.pack.createObject('Transform')
		box.o3d_transform.addShape(this.shape)
		box.o3d_transform.translate(pos)
		box.o3d_transform.quaternionRotate(ori)
		box.o3d_transform.parent = g_client.root;
		return box
	}

	this.actualTime = 0.0
	this.steppedTime = 0.0
	this.step = function(elapsed){
		if (this.running) {
			var stepsTaken = 0
			this.actualTime += elapsed
			while (this.steppedTime + this.world.timestep < this.actualTime) {
				this.world.step()
				this.steppedTime += this.world.timestep
				stepsTaken++
			}
		//console.log("step elapsed: "+elapsed+" actual: "+this.actualTime+" stepped: "+this.steppedTime+" steps: "+stepsTaken)
		}
		for (var j = 0; j < this.world.dynamics.length; j++) {
			obj = this.world.dynamics[j]
			//			window.g_transformArray[1].identity()
			//			window.g_transformArray[1].translate(obj.pos)
			obj.o3d_transform.identity()
			obj.o3d_transform.translate(obj.pos)
		/// FIXME: orientation!
		}
	}
	// add us to the worlds to render
	g_worlds.push(this)
}

// main entry point:
b3do.run = function(cb) {
	g_cb = cb
	g_debug_http = new XMLHttpRequest()

    // Runs the sample in V8. Comment out this line to run it in the browser
    // JavaScript engine, for example if you want to debug it.
    o3djs.util.setMainEngine(o3djs.util.Engine.V8)

    o3djs.util.makeClients(b3do_main)
}

g_rendered_frames=0
g_worlds=[]
function onrender(ev) {
	g_rendered_frames++
//	debug("onrender frame: "+g_rendered_frames + " elapsed: " + ev.elapsedTime,5)
	for(var i in g_worlds) {
		g_worlds[i].step(ev.elapsedTime)
	}
}

/**
 * Initializes global variables, positions camera, draws shapes.
 * @param {Array} clientElements Array of o3d object elements.
 */
function b3do_main(clientElements) {

    initGlobals(clientElements)

    // Set up the view and projection transformations.
    initContext()

	// Set up render callback
	g_client.setRenderCallback(onrender)
	g_cb()
}

/**
 * Initializes global variables and libraries.
 */
function initGlobals(clientElements) {
    g_o3dElement = clientElements[0]
    window.g_client = g_client = g_o3dElement.client
    g_o3d = g_o3dElement.o3d
    g_math = o3djs.math

    // Create a pack to manage the objects created.
    g_pack = g_client.createPack()
	debug("initGlobals g_pack: " + g_pack)
    // Create the render graph for a view.
    g_viewInfo = o3djs.rendergraph.createBasicView(
            g_pack,
            g_client.root,
            g_client.renderGraphRoot)
    window.document.onkeypress = keyPressedCallback
	window.g_viewInfo = g_viewInfo
}

/**
 * Sets up reasonable view and projection matrices.
 */
function initContext() {
    // Set up a perspective transformation for the projection.
    g_viewInfo.drawContext.projection = g_math.matrix4.perspective(
            g_math.degToRad(30), // 30 degree frustum.
            g_o3dElement.clientWidth / g_o3dElement.clientHeight, // Aspect ratio.
            1,                                    // Near plane.
            5000)                            // Far plane.

    // Set up our view transformation to look towards the world origin where the
    // primitives are located.
    g_viewInfo.drawContext.view = g_math.matrix4.lookAt(
            g_eyePosition,     // eye
            g_target,        // target
            [0, 1, 0])    // up
}
