var CZ;
(function (CZ) {
    (function (Tours) {
        Tours.isTourWindowVisible = false;
        Tours.isBookmarksWindowVisible = false;
        Tours.isBookmarksWindowExpanded = true;
        Tours.isBookmarksTextShown = true;
        Tours.isNarrationOn = true;
        Tours.tours;
        Tours.tour;
        Tours.tourBookmarkTransitionCompleted;
        Tours.tourBookmarkTransitionInterrupted;
        Tours.pauseTourAtAnyAnimation = false;
        Tours.bookmarkAnimation;
        var isToursDebugEnabled = false;
        var TourBookmark = (function () {
            function TourBookmark(url, caption, lapseTime, text) {
                this.url = url;
                this.caption = caption;
                this.lapseTime = lapseTime;
                this.text = text;
                this.duration = undefined;
                this.number = 0;
                this.elapsed = 0;
            }
            return TourBookmark;
        })();        
        function getBookmarkVisible(bookmark) {
            return CZ.UrlNav.navStringToVisible(bookmark.url, CZ.Common.vc);
        }
        Tours.getBookmarkVisible = getBookmarkVisible;
        var Tour = (function () {
            function Tour(title, bookmarks, zoomTo, vc, category, audioBlobUrl, sequenceNum) {
                this.title = title;
                this.bookmarks = bookmarks;
                this.zoomTo = zoomTo;
                this.vc = vc;
                this.category = category;
                this.audioBlobUrl = audioBlobUrl;
                this.sequenceNum = sequenceNum;
                this.tour_BookmarkStarted = [];
                this.tour_BookmarkFinished = [];
                this.tour_TourStarted = [];
                this.tour_TourFinished = [];
                this.state = 'pause';
                this.currentPlace = {
                    type: 'goto',
                    bookmark: 0,
                    startTime: null,
                    animationId: null
                };
                this.isTourPlayRequested = false;
                this.isAudioLoaded = false;
                this.isAudioEnabled = false;
                if(!bookmarks || bookmarks.length == 0) {
                    throw "Tour has no bookmarks";
                }
                var self = this;
                bookmarks.sort(function (b1, b2) {
                    return b1.lapseTime - b2.lapseTime;
                });
                for(var i = 1; i < bookmarks.length; i++) {
                    bookmarks[i - 1].duration = bookmarks[i].lapseTime - bookmarks[i - 1].lapseTime;
                    bookmarks[i - 1].number = i;
                }
                bookmarks[bookmarks.length - 1].duration = 10;
                bookmarks[bookmarks.length - 1].number = bookmarks.length;
                self.toggleAudio = function toggleAudio(isOn) {
                    if(isOn) {
                        self.isAudioEnabled = true;
                    } else {
                        self.isAudioEnabled = false;
                    }
                };
                self.ReinitializeAudio = function ReinitializeAudio() {
                    if(self.audio) {
                        self.audio.pause();
                    }
                    self.audio = undefined;
                    self.isAudioLoaded = false;
                    self.audio = document.createElement('audio');
                    self.audio.addEventListener("loadedmetadata", function () {
                        if(self.audio.duration != Infinity) {
                            self.bookmarks[self.bookmarks.length - 1].duration = self.audio.duration - self.bookmarks[self.bookmarks.length - 1].lapseTime;
                        }
                        if(isToursDebugEnabled && window.console && console.log("Tour " + self.title + " metadata loaded (readystate 1)")) {
                            ;
                        }
                    });
                    self.audio.addEventListener("canplaythrough", function () {
                        self.isAudioLoaded = true;
                        if(isToursDebugEnabled && window.console && console.log("Tour " + self.title + " readystate 4")) {
                            ;
                        }
                    });
                    self.audio.addEventListener("progress", function () {
                        if(self.audio && self.audio.buffered.length > 0) {
                            if(isToursDebugEnabled && window.console && console.log("Tour " + self.title + " downloaded " + (self.audio.buffered.end(self.audio.buffered.length - 1) / self.audio.duration))) {
                                ;
                            }
                        }
                    });
                    self.audio.controls = false;
                    self.audio.autoplay = false;
                    self.audio.loop = false;
                    self.audio.volume = 1;
                    self.audio.preload = "none";
                    var blobPrefix = self.audioBlobUrl.substring(0, self.audioBlobUrl.length - 3);
                    for(var i = 0; i < CZ.Settings.toursAudioFormats.length; i++) {
                        var audioSource = document.createElement("Source");
                        audioSource.setAttribute("src", blobPrefix + CZ.Settings.toursAudioFormats[i].ext);
                        self.audio.appendChild(audioSource);
                    }
                    self.audio.load();
                    if(isToursDebugEnabled && window.console && console.log("Loading of tour " + self.title + " is queued")) {
                        ;
                    }
                };
                self.onBookmarkIsOver = function onBookmarkIsOver(goBack) {
                    self.bookmarks[self.currentPlace.bookmark].elapsed = 0;
                    if((self.currentPlace.bookmark == self.bookmarks.length - 1) && !goBack) {
                        self.state = 'pause';
                        self.currentPlace = {
                            type: 'goto',
                            bookmark: 0
                        };
                        self.RaiseTourFinished();
                    } else {
                        self.goToTheNextBookmark(goBack);
                    }
                };
                self.goToTheNextBookmark = function goToTheNextBookmark(goBack) {
                    var newBookmark = self.currentPlace.bookmark;
                    var oldBookmark = newBookmark;
                    if(goBack) {
                        newBookmark = Math.max(0, newBookmark - 1);
                    } else {
                        newBookmark = Math.min(self.bookmarks.length - 1, newBookmark + 1);
                    }
                    self.RaiseBookmarkFinished(oldBookmark);
                    self.currentPlace = {
                        type: 'goto',
                        bookmark: newBookmark
                    };
                    var bookmark = self.bookmarks[self.currentPlace.bookmark];
                    if(newBookmark != 0) {
                        self.RaiseBookmarkStarted(bookmark);
                        if(self.isAudioEnabled && self.state === 'play' && self.isAudioLoaded == true) {
                            self.startBookmarkAudio(bookmark);
                        }
                    }
                    if(self.state != 'pause' && self.isAudioLoaded == true) {
                        self.setTimer(bookmark);
                    }
                    if(isToursDebugEnabled && window.console && console.log("Transitioning to the bm index " + newBookmark)) {
                        ;
                    }
                    self.currentPlace.animationId = self.zoomTo(getBookmarkVisible(bookmark), self.onGoToSuccess, self.onGoToFailure, bookmark.url);
                };
                self.startBookmarkAudio = function startBookmarkAudio(bookmark) {
                    if(isToursDebugEnabled && window.console && console.log("playing source: " + self.audio.currentSrc)) {
                        ;
                    }
                    self.audio.pause();
                    try  {
                        self.audio.currentTime = bookmark.lapseTime + bookmark.elapsed;
                        if(isToursDebugEnabled && window.console && console.log("audio currentTime is set to " + (bookmark.lapseTime + bookmark.elapsed))) {
                            ;
                        }
                    } catch (ex) {
                        if(window.console && console.error("currentTime assignment: " + ex)) {
                            ;
                        }
                    }
                    if(isToursDebugEnabled && window.console && console.log("audio element is forced to play")) {
                        ;
                    }
                    self.audio.play();
                };
                self.setTimer = function setTimer(bookmark) {
                    if(self.timerOnBookmarkIsOver) {
                        clearTimeout(self.timerOnBookmarkIsOver);
                    }
                    var duration = bookmark.duration;
                    if(bookmark.elapsed != 0) {
                        duration = Math.max(duration - bookmark.elapsed, 0);
                    }
                    self.currentPlace.startTime = new Date().getTime();
                    if(isToursDebugEnabled && window.console && console.log("transition to next bookmark will be in " + duration + " seconds")) {
                        ;
                    }
                    self.timerOnBookmarkIsOver = setTimeout(self.onBookmarkIsOver, duration * 1000);
                };
                self.onGoToSuccess = function onGoToSuccess(animationId) {
                    if(!self.currentPlace || self.currentPlace.animationId == undefined || self.currentPlace.animationId != animationId) {
                        return;
                    }
                    var curURL = CZ.UrlNav.getURL();
                    if(typeof curURL.hash.params == 'undefined') {
                        curURL.hash.params = [];
                    }
                    curURL.hash.params["tour"] = Tours.tour.sequenceNum;
                    CZ.Common.hashHandle = false;
                    CZ.UrlNav.setURL(curURL);
                    if(isToursDebugEnabled && window.console && console.log("reached the bookmark index " + self.currentPlace.bookmark)) {
                        ;
                    }
                    self.currentPlace = {
                        type: 'bookmark',
                        bookmark: self.currentPlace.bookmark
                    };
                    if(self.currentPlace.bookmark == 0) {
                        var bookmark = self.bookmarks[self.currentPlace.bookmark];
                        self.RaiseBookmarkStarted(bookmark);
                        if(self.state != 'pause') {
                            if(self.isAudioLoaded != true) {
                                tourPause();
                            } else {
                                self.setTimer(bookmark);
                                if(self.isAudioEnabled) {
                                    self.startBookmarkAudio(bookmark);
                                }
                            }
                        }
                    }
                };
                self.onGoToFailure = function onGoToFailure(animationId) {
                    if(!self.currentPlace || self.currentPlace.animationId == undefined || self.currentPlace.animationId != animationId) {
                        return;
                    }
                    self.pause();
                    if(isToursDebugEnabled && window.console && console.log("tour interrupted by user during transition")) {
                        ;
                    }
                };
                self.play = function play() {
                    if(self.state !== 'pause') {
                        return;
                    }
                    if(isToursDebugEnabled && window.console && console.log("tour playback activated")) {
                        ;
                    }
                    self.state = 'play';
                    var visible = self.vc.virtualCanvas("getViewport").visible;
                    if(self.currentPlace != null && self.currentPlace.bookmark != null && CZ.Common.compareVisibles(visible, getBookmarkVisible(self.bookmarks[self.currentPlace.bookmark]))) {
                        self.currentPlace = {
                            type: 'bookmark',
                            bookmark: self.currentPlace.bookmark
                        };
                    } else {
                        self.currentPlace = {
                            type: 'goto',
                            bookmark: self.currentPlace.bookmark
                        };
                    }
                    var bookmark = self.bookmarks[self.currentPlace.bookmark];
                    var isInTransitionToFirstBookmark = (self.currentPlace.bookmark == 0 && self.currentPlace.type == 'goto');
                    if(self.currentPlace.type == 'bookmark' || self.currentPlace.bookmark != 0) {
                        self.RaiseBookmarkStarted(bookmark);
                        if(self.isAudioLoaded == true) {
                            self.setTimer(bookmark);
                            if(self.isAudioEnabled) {
                                self.startBookmarkAudio(bookmark);
                            }
                        }
                    }
                    self.currentPlace.animationId = self.zoomTo(getBookmarkVisible(bookmark), self.onGoToSuccess, self.onGoToFailure, bookmark.url);
                    if(self.currentPlace.bookmark === 0 && isInTransitionToFirstBookmark) {
                        self.RaiseTourStarted();
                    }
                    var curURL = CZ.UrlNav.getURL();
                    if(typeof curURL.hash.params == 'undefined') {
                        curURL.hash.params = new Array();
                    }
                    if(typeof curURL.hash.params["tour"] == 'undefined') {
                        curURL.hash.params["tour"] = Tours.tour.sequenceNum;
                        CZ.Common.hashHandle = false;
                        CZ.UrlNav.setURL(curURL);
                    }
                };
                self.pause = function pause() {
                    if(self.state !== 'play') {
                        return;
                    }
                    if(isToursDebugEnabled && window.console && console.log("tour playback paused")) {
                        ;
                    }
                    if(self.isAudioEnabled && self.isTourPlayRequested) {
                        self.isTourPlayRequested = false;
                    }
                    if(self.timerOnBookmarkIsOver) {
                        clearTimeout(self.timerOnBookmarkIsOver);
                        self.timerOnBookmarkIsOver = undefined;
                    }
                    self.state = 'pause';
                    if(self.isAudioEnabled) {
                        self.audio.pause();
                        if(isToursDebugEnabled && window.console && console.log("audio element is forced to pause")) {
                            ;
                        }
                    }
                    var bookmark = self.bookmarks[self.currentPlace.bookmark];
                    if(self.currentPlace.startTime) {
                        bookmark.elapsed += (new Date().getTime() - self.currentPlace.startTime) / 1000;
                    }
                };
                self.next = function next() {
                    if(self.currentPlace.bookmark != self.bookmarks.length - 1) {
                        if(self.state === 'play') {
                            if(self.timerOnBookmarkIsOver) {
                                clearTimeout(self.timerOnBookmarkIsOver);
                            }
                            self.timerOnBookmarkIsOver = undefined;
                        }
                        self.onBookmarkIsOver(false);
                    }
                };
                self.prev = function prev() {
                    if(self.currentPlace.bookmark == 0) {
                        return;
                    }
                    if(self.state === 'play') {
                        if(self.timerOnBookmarkIsOver) {
                            clearTimeout(self.timerOnBookmarkIsOver);
                        }
                        self.timerOnBookmarkIsOver = undefined;
                    }
                    self.onBookmarkIsOver(true);
                };
                self.RaiseBookmarkStarted = function RaiseBookmarkStarted(bookmark) {
                    if(self.tour_BookmarkStarted.length > 0) {
                        for(var i = 0; i < self.tour_BookmarkStarted.length; i++) {
                            self.tour_BookmarkStarted[i](self, bookmark);
                        }
                    }
                };
                self.RaiseBookmarkFinished = function RaiseBookmarkFinished(bookmark) {
                    if(self.tour_BookmarkFinished.length > 0) {
                        for(var i = 0; i < self.tour_BookmarkFinished.length; i++) {
                            self.tour_BookmarkFinished[i](self, bookmark);
                        }
                    }
                };
                self.RaiseTourStarted = function RaiseTourStarted() {
                    if(self.tour_TourStarted.length > 0) {
                        for(var i = 0; i < self.tour_TourStarted.length; i++) {
                            self.tour_TourStarted[i](self);
                        }
                    }
                };
                self.RaiseTourFinished = function RaiseTourFinished() {
                    if(self.tour_TourFinished.length > 0) {
                        for(var i = 0; i < self.tour_TourFinished.length; i++) {
                            self.tour_TourFinished[i](self);
                        }
                    }
                };
            }
            return Tour;
        })();
        Tours.Tour = Tour;        
        function activateTour(newTour, isAudioEnabled) {
            if(newTour != undefined) {
                var tourControlDiv = document.getElementById("tour_control");
                tourControlDiv.style.display = "block";
                Tours.tour = newTour;
                Tours.tour.tour_TourFinished.push(function (tour) {
                    hideBookmark(tour);
                    tourPause();
                    hideBookmarks();
                });
                Tours.tour.toggleAudio(isAudioEnabled);
                for(var i = 0; i < Tours.tour.bookmarks.length; i++) {
                    Tours.tour.bookmarks[i].elapsed = 0;
                }
                Tours.tour.currentPlace.bookmark = 0;
                if(isAudioEnabled == true) {
                    Tours.tour.ReinitializeAudio();
                    Tours.tour.isAudioLoaded = true;
                }
                tourResume();
            }
        }
        Tours.activateTour = activateTour;
        function removeActiveTour() {
            if(Tours.tour) {
                tourPause();
                Tours.tour.isTourPlayRequested = false;
            }
            var tourControlDiv = document.getElementById("tour_control");
            tourControlDiv.style.display = "none";
            if(Tours.tour) {
                hideBookmarks();
                $("#bookmarks .header").html("");
                if(Tours.tour.audio) {
                    Tours.tour.audio = undefined;
                }
            }
            Tours.tour = undefined;
        }
        function tourPrev() {
            if(Tours.tour != undefined) {
                Tours.tour.prev();
            }
        }
        Tours.tourPrev = tourPrev;
        function tourNext() {
            if(Tours.tour != undefined) {
                Tours.tour.next();
            }
        }
        Tours.tourNext = tourNext;
        function tourPause() {
            if(Tours.tour != undefined) {
                $("#tour_playpause").attr("src", "/Images/tour_play_off.jpg");
                Tours.tour.pause();
                CZ.Common.controller.stopAnimation();
                Tours.tour.tourBookmarkTransitionInterrupted = undefined;
                Tours.tour.tourBookmarkTransitionCompleted = undefined;
            }
        }
        Tours.tourPause = tourPause;
        function tourResume() {
            $("#tour_playpause").attr("src", "/Images/tour_pause_off.jpg");
            Tours.tour.play();
        }
        function tourPlayPause() {
            if(Tours.tour != undefined) {
                if(Tours.tour.state == "pause") {
                    tourResume();
                } else if(Tours.tour.state == "play") {
                    tourPause();
                }
            }
        }
        Tours.tourPlayPause = tourPlayPause;
        function tourAbort() {
            removeActiveTour();
            $("#bookmarks").hide();
            Tours.isBookmarksWindowVisible = false;
            var curURL = CZ.UrlNav.getURL();
            delete curURL.hash.params["tour"];
            delete curURL.hash.params["bookmark"];
            CZ.UrlNav.setURL(curURL);
        }
        Tours.tourAbort = tourAbort;
        function initializeToursUI() {
            $("#tours").hide();
            hideBookmarks();
        }
        Tours.initializeToursUI = initializeToursUI;
        function initializeToursContent() {
            var toursUI = $('#tours-content');
            Tours.tours.sort(function (u, v) {
                return u.sequenceNum - v.sequenceNum;
            });
            var category = null;
            var categoryContent;
            for(var i = 0; i < Tours.tours.length; i++) {
                var tour = Tours.tours[i];
                tour.tour_BookmarkStarted.push(function (t, bookmark) {
                    showBookmark(t, bookmark);
                });
                tour.tour_BookmarkFinished.push(function (t, bookmark) {
                    hideBookmark(t);
                });
                if(tour.category !== category) {
                    var cat = $('<div class="category">' + tour.category + '</div>').appendTo(toursUI);
                    var img = $('<img src="/Images/collapse-down.png" class="collapseButton" />').appendTo(cat);
                    if(i == 0) {
                        cat.removeClass('category').addClass('categorySelected');
                        (img[0]).src = "/Images/collapse-up.png";
                    }
                    categoryContent = $('<div class="itemContainer"></div>').appendTo(toursUI);
                    category = tour.category;
                }
                $('<div class="item" tour="' + i + '">' + tour.title + '</div>').appendTo(categoryContent).click(function () {
                    removeActiveTour();
                    $("#tours").hide('slide', {
                    }, 'slow');
                    CZ.Common.toggleOffImage('tours_index');
                    Tours.isTourWindowVisible = false;
                    var mytour = Tours.tours[this.getAttribute("tour")];
                    activateTour(mytour, Tours.isNarrationOn);
                    $(".touritem-selected").removeClass("touritem-selected", "slow");
                    $(this).addClass("touritem-selected", "slow");
                });
            }
            ($)("#tours-content").accordion({
                fillSpace: false,
                collapsible: true,
                autoHeight: false
            });
            $("#tours-content").bind("accordionchangestart", function (event, ui) {
                if(ui.newHeader) {
                    ui.newHeader.removeClass('category');
                    ui.newHeader.addClass('categorySelected');
                    var img = ($(".collapseButton", ui.newHeader)[0]);
                    if(img) {
                        img.src = "/Images/collapse-up.png";
                    }
                }
                if(ui.oldHeader) {
                    ui.oldHeader.removeClass('categorySelected');
                    ui.oldHeader.addClass('category');
                    var img = ($(".collapseButton", ui.oldHeader)[0]);
                    if(img) {
                        img.src = "/Images/collapse-down.png";
                    }
                }
            });
        }
        Tours.initializeToursContent = initializeToursContent;
        function hideBookmark(tour) {
            if(Tours.isBookmarksWindowExpanded && Tours.isBookmarksTextShown) {
                if(Tours.bookmarkAnimation) {
                    Tours.bookmarkAnimation.stop(true, true);
                }
                Tours.bookmarkAnimation = $("#bookmarks .slideText").hide("drop", {
                }, 'slow', function () {
                    Tours.bookmarkAnimation = undefined;
                });
                $("#bookmarks .slideHeader").html("");
                Tours.isBookmarksTextShown = false;
            }
        }
        function showBookmark(tour, bookmark) {
            if(!Tours.isBookmarksWindowVisible) {
                Tours.isBookmarksWindowVisible = true;
                $("#bookmarks .slideText").html(bookmark.text);
                $("#bookmarks").show('slide', {
                }, 'slow');
            }
            $("#bookmarks .header").html(tour.title);
            $("#bookmarks .slideHeader").html(bookmark.caption);
            $("#bookmarks .slideFooter").html(bookmark.number + '/' + tour.bookmarks.length);
            if(Tours.isBookmarksWindowExpanded) {
                $("#bookmarks .slideText").html(bookmark.text);
                if(!Tours.isBookmarksTextShown) {
                    if(Tours.bookmarkAnimation) {
                        Tours.bookmarkAnimation.stop(true, true);
                    }
                    Tours.bookmarkAnimation = $("#bookmarks .slideText").show("drop", {
                    }, 'slow', function () {
                        Tours.bookmarkAnimation = undefined;
                    });
                    Tours.isBookmarksTextShown = true;
                }
            } else {
                $("#bookmarks .slideText").html(bookmark.text);
            }
        }
        function hideBookmarks() {
            $("#bookmarks").hide();
            Tours.isBookmarksWindowVisible = false;
        }
        function onTourClicked() {
            if(CZ.Search.isSearchWindowVisible) {
                CZ.Search.onSearchClicked();
            }
            if(Tours.isTourWindowVisible) {
                CZ.Common.toggleOffImage('tours_index');
                $("#tours").hide('slide', {
                }, 'slow');
            } else {
                CZ.Common.toggleOnImage('tours_index');
                $("#tours").show('slide', {
                }, 'slow');
            }
            Tours.isTourWindowVisible = !Tours.isTourWindowVisible;
        }
        Tours.onTourClicked = onTourClicked;
        function tourButtonHighlight(isOn) {
            if(isOn) {
                CZ.Common.toggleOnImage('tours_index');
            } else {
                if(!Tours.isTourWindowVisible) {
                    CZ.Common.toggleOffImage('tours_index');
                }
            }
        }
        Tours.tourButtonHighlight = tourButtonHighlight;
        function collapseBookmarks() {
            if(!Tours.isBookmarksWindowExpanded) {
                return;
            }
            Tours.isBookmarksWindowExpanded = false;
            $("#bookmarks .header").hide('slide', {
            }, 'fast');
            $("#bookmarks .slideHeader").hide('slide', {
            }, 'fast');
            $("#bookmarks .slideText").hide('slide', {
            }, 'fast');
            $("#bookmarks .slideFooter").hide('slide', {
            }, 'fast');
            $("#bookmarks").effect('size', {
                to: {
                    width: 30
                }
            }, 'fast');
            $("#bookmarksCollapse").attr("src", "/Images/expand-right.png");
        }
        function expandBookmarks() {
            if(Tours.isBookmarksWindowExpanded) {
                return;
            }
            Tours.isBookmarksWindowExpanded = true;
            $("#bookmarks").effect('size', {
                to: {
                    width: '200px',
                    height: 'auto'
                }
            }, 'slow', function () {
                $("#bookmarks").css('height', 'auto');
                $("#bookmarks .header").show('slide', {
                }, 'fast');
                $("#bookmarks .slideHeader").show('slide', {
                }, 'fast');
                $("#bookmarks .slideText").show('slide', {
                }, 'fast');
                $("#bookmarks .slideFooter").show('slide', {
                }, 'fast');
            });
            $("#bookmarksCollapse").attr("src", "/Images/collapse-left.png");
        }
        function onBookmarksCollapse() {
            if(!Tours.isBookmarksWindowExpanded) {
                expandBookmarks();
            } else {
                collapseBookmarks();
            }
        }
        Tours.onBookmarksCollapse = onBookmarksCollapse;
        function onNarrationClick() {
            if(Tours.isNarrationOn) {
                $("#tours-narration-on").removeClass("narration-selected", "slow");
                $("#tours-narration-off").addClass("narration-selected", "slow");
            } else {
                $("#tours-narration-on").addClass("narration-selected", "slow");
                $("#tours-narration-off").removeClass("narration-selected", "slow");
            }
            Tours.isNarrationOn = !Tours.isNarrationOn;
        }
        Tours.onNarrationClick = onNarrationClick;
        function parseTours(content) {
            Tours.tours = new Array();
            for(var i = 0; i < content.d.length; i++) {
                var areBookmarksValid = true;
                var tourString = content.d[i];
                if((typeof tourString.bookmarks == 'undefined') || (typeof tourString.AudioBlobUrl == 'undefined') || (tourString.AudioBlobUrl == undefined) || (tourString.AudioBlobUrl == null) || (typeof tourString.Category == 'undefined') || (typeof tourString.Name == 'undefined') || (typeof tourString.Sequence == 'undefined')) {
                    continue;
                }
                var tourBookmarks = new Array();
                for(var j = 0; j < tourString.bookmarks.length; j++) {
                    var bmString = tourString.bookmarks[j];
                    if((typeof bmString.Description == 'undefined') || (typeof bmString.LapseTime == 'undefined') || (typeof bmString.Name == 'undefined') || (typeof bmString.URL == 'undefined')) {
                        areBookmarksValid = false;
                        break;
                    }
                    var bmURL = bmString.URL;
                    if(bmURL.indexOf("#") != -1) {
                        bmURL = bmURL.substring(bmURL.indexOf("#") + 1);
                    }
                    tourBookmarks.push(new TourBookmark(bmURL, bmString.Name, bmString.LapseTime, bmString.Description));
                }
                if(!areBookmarksValid) {
                    continue;
                }
                Tours.tours.push(new Tour(tourString.Name, tourBookmarks, bookmarkTransition, CZ.Common.vc, tourString.Category, tourString.AudioBlobUrl, tourString.Sequence));
            }
        }
        Tours.parseTours = parseTours;
        function bookmarkTransition(visible, onCompleted, onInterrupted, bookmark) {
            Tours.tourBookmarkTransitionCompleted = onCompleted;
            Tours.tourBookmarkTransitionInterrupted = onInterrupted;
            Tours.pauseTourAtAnyAnimation = false;
            var animId = CZ.Common.setVisible(visible);
            if(animId && bookmark) {
                CZ.Common.setNavigationStringTo = {
                    bookmark: bookmark,
                    id: animId
                };
            }
            return animId;
        }
        function loadTourFromURL() {
            var curURL = CZ.UrlNav.getURL();
            if((typeof curURL.hash.params !== 'undefined') && (curURL.hash.params["tour"] > Tours.tours.length)) {
                return;
            }
            if(typeof curURL.hash.params !== 'undefined' && typeof curURL.hash.params["tour"] !== 'undefined') {
                if(Tours.tours == null) {
                    initializeToursContent();
                }
                if(Tours.isTourWindowVisible) {
                    onTourClicked();
                }
                Tours.tour = Tours.tours[curURL.hash.params["tour"] - 1];
                $(".touritem-selected").removeClass("touritem-selected", "slow");
                activateTour(Tours.tour, true);
                if(Tours.tour.audio) {
                    Tours.tour.audio.pause();
                    Tours.tour.audio.preload = "none";
                }
                tourPause();
            }
        }
        Tours.loadTourFromURL = loadTourFromURL;
    })(CZ.Tours || (CZ.Tours = {}));
    var Tours = CZ.Tours;
})(CZ || (CZ = {}));