var formatSeconds = function (seconds) {
	var s = seconds % 60;
	if (s < 9) {
		s = '0' + s;
	}
	return parseInt(seconds / 60) + ':' + s;
};

var ReminderDef = function (name, time, repeat, visible, hasConfirm, audio) {
	this.name = ko.observable(name || 'New Timer');
	this.time = ko.observable(time || 0);
	this.repeat = ko.observable(repeat || false);
	this.visible = ko.observable(visible || true);
	this.hasConfirm = ko.observable(hasConfirm || true);
	this.audio = ko.observable(audio || false);

	this.isActive = ko.observable(false);
	this.currentTime = ko.observable(0);

	this.timeMins = ko.observable(parseInt(this.time() / 60));
	this.timeSecs = ko.observable(this.time() % 60);

	this.text = ko.computed(function () {
		return '(' + formatSeconds(this.currentTime()) + ') ' + this.name();
	}, this);

	this.timeMins.subscribe(this.recalcTime, this);
	this.timeSecs.subscribe(this.recalcTime, this);
	this.isActive.subscribe(function (val) { this.currentTime(val ? this.time() : 0); }, this);
};
ReminderDef.prototype.recalcTime = function () {
	this.time(this.timeMins() * 60 + this.timeSecs());
};
ReminderDef.prototype.toJson = function () {
	return {
		name: this.name(),
		time: this.time(),
		repeat: this.repeat(),
		visible: this.visible(),
		hasConfirm: this.hasConfirm(),
		audio: this.audio()
	};
};
ReminderDef.prototype.tick = function () {
	this.currentTime(this.currentTime() - 1);

	if (this.currentTime() <= 0) {
		//Trigger!
		if (this.repeat()) {
			this.currentTime(this.time());
		} else {
			this.isActive(false);
		}

		//TODO: Visible / audio

		console.log('trigger: ' + this.name());
	}
};

model.reminderTimer = {

	timers: ko.observableArray([
		new ReminderDef('Scout More', 123),
		new ReminderDef('Check Nuke', 5),
		new ReminderDef('Hide Comm', 179)
	]),

	selectedTimer: ko.observable(),

	manageVisible: ko.observable(false),

	init: function () {
		if (this.timers().length > 0) {
			this.selectedTimer(this.timers()[0]);
		}

		//Proxy these so they work right with ko callbacks
		this.toggleManage = $.proxy(this.toggleManage, this);
		this.addTimer = $.proxy(this.addTimer, this);
		this.removeTimer = $.proxy(this.removeTimer, this);

		//Create div, add to page
		this.manage = $(
			'<div id="remindertimer_manage" data-bind="visible: model.reminderTimer.manageVisible">' +
				'<div class="close" data-bind="click: model.reminderTimer.toggleManage">X</div>' +
				'<h1>Manage Reminders</h1>' +
				'<table>' +
					'<tr><th>Select Reminder</th><td>' +
					'<select data-bind="options: model.reminderTimer.timers, optionsText: \'name\', value: model.reminderTimer.selectedTimer"></select>' +
					'<button data-bind="click: model.reminderTimer.addTimer">+</button>' +
					'<button data-bind="click: model.reminderTimer.removeTimer">-</button>' +
					'</td></tr>' +
					'<!-- ko if: model.reminderTimer.selectedTimer -->' +
						'<tr><th>Name</th><td><input data-bind="value: model.reminderTimer.selectedTimer().name" /></td></tr>' +
						'<tr><th>Time</th><td>' +
							'<input data-bind="value: model.reminderTimer.selectedTimer().timeMins" type="number" min="0"/>:' +
							'<input  data-bind="value: model.reminderTimer.selectedTimer().timeSecs" type="number" min="0" max="59" step="10" /> (mm:ss)</td></tr>' +
						'<tr><td colspan="2">When this timer expires, do the following</td></tr>' +
						'<tr><th>Repeat</th><td><input data-bind="checked: model.reminderTimer.selectedTimer().repeat" type="checkbox" /> Repeat</td></tr>' +
						'<tr><th>Visible</th><td><input data-bind="checked: model.reminderTimer.selectedTimer().visible" type="checkbox" /> Show a message</td></tr>' +
						'<tr><th>Confirm</th><td><input data-bind="checked: model.reminderTimer.selectedTimer().hasConfirm" type="checkbox" /> Show message until confirmed</td></tr>' +
						'<tr><th>Audio</th><td><input data-bind="checked: model.reminderTimer.selectedTimer().audio" type="checkbox" /> Play an audio queue</td></tr>' +
					'<!-- /ko -->' +
				'</table>' +
			'</div>');

		this.timersEl = $(
			'<div id="remindertimers">' +

				'<!-- ko foreach: model.reminderTimer.timers -->' +
					'<div data-bind="click: model.reminderTimer.clickTimer, text: text" class="timer">FIXME</div>' +
				'<!-- /ko -->' +

				'<div class="managebutton" data-bind="click: model.reminderTimer.toggleManage">Manage</div>' +
				'<div class="quicktimer">' +
					'Quick <input type="text" /><br/>' +
					'<button data-bind="click: function() { model.reminderTimer.clickQuick(1); }">1m</button>' +
					'<button data-bind="click: function() { model.reminderTimer.clickQuick(2); }">2m</button>' +
					'<button data-bind="click: function() { model.reminderTimer.clickQuick(3); }">3m</button>' +
					'<button data-bind="click: function() { model.reminderTimer.clickQuick(4); }">4m</button>' +
					'<button data-bind="click: function() { model.reminderTimer.clickQuick(5); }">5m</button>' +
				'</div>' +
			'</div>');

		this.timersEl.prepend(this.manage);
		$('.div_player_list_panel').append(this.timersEl);


		this.selectedTimer.subscribe(this.selectChanged, this);

		//Try really hard not to retain focus so we don't break keyboard shortcuts
		$('select', this.container).change(this.blurAll);
		$(':checkbox', this.container).click(this.blurAll);
		$(document).keydown($.proxy(function (e) {
			if (e.keyCode == 27) {
				this.blurAll();
			}
		}, this));

		setInterval($.proxy(this.timerTick, this), 1000);
	},

	timerTick: function () {
		this.timers().forEach(function (timer) {
			if (timer.isActive()) {
				timer.tick();
			}
		}, this);
	},

	toggleManage: function () {
		this.manageVisible(!this.manageVisible());
	},
	addTimer: function () {
		var timer = new ReminderDef();
		this.timers.push(timer);
		this.selectedTimer(timer);
	},
	removeTimer: function () {
		this.timers.remove(this.selectedTimer());
		if (this.timers().length > 0) {
			this.selectedTimer(this.timers()[0]);
		} else {
			this.selectedTimer(false);
		}
	},
	blurAll: function () {
		$(document.activeElement).blur();
	},

	clickTimer: function (e) {
		e.isActive(!e.isActive());
	},

	clickQuick: function (e) {
		console.log('quick ' + e);
	},

	selectChanged: function (e, e2, e3) {
		console.log('selectChanged');
		console.log(e);
	}
};
model.reminderTimer.init();