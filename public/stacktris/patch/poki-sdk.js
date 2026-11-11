(() => {
	// Local-only PokiSDK stub. This repo previously loaded the full Poki SDK which
	// can pull additional third-party scripts. For offline/self-contained runs we
	// provide only the surface area used by webapp/source_min.js.
	var getParam = function(name) {
		var m = RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
		return m && decodeURIComponent(m[1].replace(/\+/g, " "))
	};

	var resolved = function(value) {
		return new Promise(function(r) { r(value); });
	};

	var noop = function() {};

	window.PokiSDK = {
		init: function() { return resolved(); },
		initWithVideoHB: function() { return resolved(); },
		customEvent: noop,
		// No ads offline: resolve immediately so gameplay continues.
		commercialBreak: function() { return resolved(); },
		// No rewarded ads offline: report "not rewarded".
		rewardedBreak: function() { return resolved(!1); },
		displayAd: noop,
		destroyAd: noop,
		getLeaderboard: function() { return resolved(); },
		getSharableURL: function() { return new Promise(function(_resolve, reject) { reject(); }); },
		getURLParam: function(n) { return getParam("gd" + n) || getParam(n) || ""; }
	};

	[
		"disableProgrammatic",
		"gameLoadingStart",
		"gameLoadingFinished",
		"gameInteractive",
		"roundStart",
		"roundEnd",
		"muteAd"
	].forEach(function(k) { window.PokiSDK[k] = noop; });

	[
		"setDebug",
		"gameplayStart",
		"gameplayStop",
		"gameLoadingProgress",
		"happyTime",
		"setPlayerAge",
		"togglePlayerAdvertisingConsent",
		"logError",
		"sendHighscore",
		"setDebugTouchOverlayController"
	].forEach(function(k) { window.PokiSDK[k] = noop; });
})();
