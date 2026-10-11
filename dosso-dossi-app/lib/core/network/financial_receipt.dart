import 'package:dio/dio.dart';

import '../diagnostics/app_telemetry.dart';
import 'api_exception.dart';
import 'mutation_intents.dart';

/// A 2xx transport response does not confirm a financial action until its typed
/// receipt can be decoded. Ambiguous replies retain the original retry key.
Future<T> postFinancialReceipt<T>({
  required Dio dio,
  required String path,
  required Map<String, dynamic> data,
  required T Function(Map<String, dynamic>) decode,
  required ApiException unconfirmed,
  required TelemetryOperation operation,
  bool Function(T)? isPending,
}) => apiCall(() async {
  final response = await dio.post<Map<String, dynamic>>(
    path,
    data: data,
    options: Options(extra: {MutationIntents.deferCompletion: true}),
  );
  try {
    final receipt = decode(response.data!);
    if (!(isPending?.call(receipt) ?? false)) {
      for (final intents in dio.interceptors.whereType<MutationIntents>()) {
        await intents.confirm(response.requestOptions);
      }
    }
    return receipt;
  } catch (error) {
    appTelemetry.report(
      operation,
      error,
      code: TelemetryCode.unconfirmedReceipt,
    );
    throw unconfirmed;
  }
});
