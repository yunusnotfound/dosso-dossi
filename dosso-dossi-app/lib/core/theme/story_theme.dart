import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Campaign stories share the existing white, orange and warm cream palette.
abstract final class StoryTheme {
  static const double diameter = 88;
  static const double itemWidth = 108;
  static const double ringWidth = 2.5;
  static const double coverScale = .86;
  static const double giftCoverScale = .76;
  static const double packageCoverScale = .80;
  static const duration = Duration(seconds: 8);
  static const posterAspectRatio = 9 / 19.5;
  static const double posterRadius = 16;
  static const posterBorder = AppColors.textOnDarkMuted;
  static const double posterDesignWidth = 360;
  static const ring = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      AppColors.primary,
      AppColors.gold,
      AppColors.surfaceTint,
      AppColors.primary,
    ],
    stops: [0, .4, .65, 1],
  );
}
