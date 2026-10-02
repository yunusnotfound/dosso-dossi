import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/story_theme.dart';
import '../application/campaign_story_providers.dart';
import '../domain/campaign_story.dart';
import 'widgets/campaign_story_artwork.dart';
import 'widgets/campaign_story_chrome.dart';

/// Full-height public campaign reader with overlaid story controls.
class CampaignStoryViewer extends ConsumerStatefulWidget {
  const CampaignStoryViewer({
    super.key,
    required this.stories,
    required this.initialIndex,
  }) : assert(stories.length > 0),
       assert(initialIndex >= 0 && initialIndex < stories.length);

  final List<CampaignStory> stories;
  final int initialIndex;

  @override
  ConsumerState<CampaignStoryViewer> createState() =>
      _CampaignStoryViewerState();
}

class _CampaignStoryViewerState extends ConsumerState<CampaignStoryViewer>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _progress;
  late int _index;
  late Map<String, CampaignStory> _published;
  Timer? _expiry;
  bool _paused = false, _holding = false, _background = false;
  bool _ready = false, _autoAllowed = true, _closing = false;
  bool _manualPlayback = false;
  Duration _pointerDownAt = Duration.zero;
  bool _heldLong = false;
  double _drag = 0;
  CampaignStory get _story => widget.stories[_index];

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    _published = {for (final story in widget.stories) story.id: story};
    _progress = AnimationController(vsync: this, duration: StoryTheme.duration)
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed) _move(1);
      });
    WidgetsBinding.instance.addObserver(this);
    _opened();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final media = MediaQuery.of(context);
    _autoAllowed = !media.disableAnimations && !media.accessibleNavigation;
    _syncPlayback();
  }

  void _opened() {
    _expiry?.cancel();
    _progress.reset();
    _ready = _story.imageUrl.isEmpty;
    _manualPlayback = false;
    final key = _story.seenKey;
    final end = _story.endsAt;
    if (end != null) {
      _expiry = Timer(end.difference(DateTime.now()), _close);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _closing || _story.seenKey != key) return;
      if (!_available(_story)) return _close();
      if (_ready) {
        ref.read(seenCampaignStoriesProvider.notifier).markSeen(_story);
      }
      _syncPlayback();
    });
  }

  void _syncPlayback() {
    if (!mounted || _closing) return;
    if (_ready &&
        (_autoAllowed || _manualPlayback) &&
        !_paused &&
        !_holding &&
        !_background) {
      _progress.forward();
    } else {
      _progress.stop();
    }
  }

  void _imageReady(String key, bool ready) {
    if (!mounted || _closing || key != _story.seenKey) return;
    if (!_available(_story)) return _close();
    _ready = ready;
    if (ready) ref.read(seenCampaignStoriesProvider.notifier).markSeen(_story);
    _syncPlayback();
  }

  void _move(int step) {
    if (!mounted || _closing) return;
    if (!_available(_story)) return _close();
    var next = _index + step;
    while (next >= 0 &&
        next < widget.stories.length &&
        !_available(widget.stories[next])) {
      next += step;
    }
    if (next >= widget.stories.length) return _close();
    if (next < 0) next = _index;
    setState(() {
      _index = next;
      _holding = false;
    });
    _opened();
  }

  bool _available(CampaignStory story) {
    final latest = _published[story.id];
    return latest != null &&
        latest.seenKey == story.seenKey &&
        latest.isVisibleAt(DateTime.now());
  }

  void _close() {
    if (!mounted || _closing) return;
    _closing = true;
    _progress.stop();
    Navigator.of(context).pop();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _background = state != AppLifecycleState.resumed;
    if (!_background && !_available(_story)) return _close();
    _syncPlayback();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(campaignStoriesProvider, (_, next) {
      // A refresh or connection error must retain the last successful snapshot.
      if (next.isLoading || next.hasError || !next.hasValue) return;
      _published = {for (final story in next.value!) story.id: story};
      if (!_available(_story)) {
        // Also close while paused or waiting on a failed image, with no ticker.
        scheduleMicrotask(_close);
      }
    });
    final story = _story;
    return CampaignStoryChrome(
      story: story,
      index: _index,
      count: widget.stories.length,
      progress: _progress,
      paused: _paused || !(_autoAllowed || _manualPlayback),
      onClose: _close,
      onPrevious: () => _move(-1),
      onNext: () => _move(1),
      onPause: () {
        setState(() {
          if (!_autoAllowed && !_manualPlayback) {
            _manualPlayback = true;
            _paused = false;
          } else {
            _paused = !_paused;
          }
        });
        _syncPlayback();
      },
      artwork: LayoutBuilder(
        builder: (context, constraints) => Listener(
          onPointerDown: (event) {
            _pointerDownAt = event.timeStamp;
            _heldLong = false;
            _holding = true;
            _syncPlayback();
          },
          onPointerUp: (event) {
            _heldLong =
                event.timeStamp - _pointerDownAt >
                const Duration(milliseconds: 250);
            _holding = false;
            _syncPlayback();
          },
          onPointerCancel: (_) {
            _holding = false;
            _syncPlayback();
          },
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            dragStartBehavior: DragStartBehavior.down,
            excludeFromSemantics: true,
            onTapUp: (event) {
              if (!_heldLong) {
                _move(
                  event.localPosition.dx < constraints.maxWidth / 2 ? -1 : 1,
                );
              }
            },
            onHorizontalDragStart: (_) => _drag = 0,
            onHorizontalDragUpdate: (event) => _drag += event.delta.dx,
            onHorizontalDragEnd: (event) {
              final direction = _drag.abs() > 40
                  ? _drag
                  : event.primaryVelocity ?? 0;
              if (direction.abs() > 40) _move(direction < 0 ? 1 : -1);
            },
            child: CampaignStoryArtwork(
              key: ValueKey(story.seenKey),
              story: story,
              onReady: (ready) => _imageReady(story.seenKey, ready),
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _expiry?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _progress.dispose();
    super.dispose();
  }
}
