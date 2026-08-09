# Математический контракт калькулятора вязания

## 1. Статус и область действия

**Версия контракта:** `1.0.0`.

Контракт определяет чистое детерминированное ядро MVP для двух операций:

1. расчёта плотности по измеренному образцу;
2. расчёта петель и рядов по плотности и целевому размеру полотна.

`targetWidth` и `targetHeight` означают желаемые размеры **готового полотна**. Это не мерки тела и не размеры с прибавкой на свободу облегания.

Не входят в контракт: UI, локализация и разбор пользовательского текста, сеть, AI, хранение истории, PWA, построение выкроек, прибавки/убавки, пересчёт готовых описаний, пряжа, блокировка и допуски на усадку. Контракт не решает, насколько измерение или плотность реалистичны для конкретного проекта.

## 2. Представление чисел, единицы и термины

Входные числовые значения передаются строками и интерпретируются как точные рациональные числа, а не как двоичные `float`. Это необходимо для воспроизводимого правила на границе `.5`.

Типы входа:

```text
Integer            = "0" | "-"? [1-9][0-9]*
NonNegativeInteger = "0" | [1-9][0-9]*
PositiveInteger    = [1-9][0-9]*
NonZeroInteger     = "-"? [1-9][0-9]*
DecimalString       = "0"
                    | "0" "." [0-9]+
                    | [1-9][0-9]* ("." [0-9]+)?
                    | "-" ("0" "." [0-9]*[1-9][0-9]*
                           | [1-9][0-9]* ("." [0-9]+)?)
```

Отрицательная ветвь `DecimalString` требует хотя бы одну ненулевую цифру: `"-0"`, `"-0.0"`, `"-0.00"` и любая другая отрицательная нулевая форма невалидны. Знак `+`, экспоненциальная запись, пробелы и локализованные разделители запрещены. `DecimalString` принимает, например, `"10"`, `"2.54"`, `"-0.125"`; его значение точно равно записанному конечному десятичному рациональному числу. Все последующие ограничения диапазона применяются после успешной проверки формата. Перечисления — строковые коды ниже. Транспорт может представлять эти типы иначе, только если без потерь сохраняет то же значение.

| Термин | Тип | Значение |
| --- | --- | --- |
| `stitches` | вход: `Integer`; выход: `PositiveInteger` | Число петель, измеренных в образце или рассчитанных для ширины. |
| `rows` | вход: `Integer`; выход: `PositiveInteger` | Число рядов, измеренных в образце или рассчитанных для высоты. В круговом вязании — число завершённых кругов (раундов). |
| `width`, `height` | `DecimalString` | Фактическая длина измеренного образца по ширине/высоте. |
| `targetWidth`, `targetHeight` | `DecimalString` | Желаемый готовый размер полотна по ширине/высоте. |
| `unit` | `"cm" \| "in"` | Единица соответствующих длин. Все длины в одном входе используют именно её. |
| `stitchDensity`, `rowDensity` | вход: `DecimalString \| RationalInput`; выход: `ExactValue` | Соответственно петель и рядов на одну единицу длины. В круговом вязании `rowDensity` — завершённых раундов на единицу высоты. |
| `rawStitches`, `rawRows` | `ExactValue` | Неокруглённые расчётные количества. В круговом вязании `rawRows` — число завершённых раундов до округления. |
| `actualWidth`, `actualHeight` | `ExactValue` | Размеры, следующие из итоговых целых количеств и плотности. |

Точная конверсия единиц: `1 in = 2.54 cm` (точно), следовательно `1 cm = 1 / 2.54 in`. `10 cm = 3.937007874015748… in`; это **не** `4 in`.

Каждая операция выполняется в единице своего входа. Конвертация допускается только до вызова ядра по коэффициенту выше; смешивать `cm` и `in` в одном запросе нельзя.

## 3. Контракт расчёта плотности

### Вход `GaugeInput`

```text
{
  stitches: Integer,
  rows: Integer,
  width: DecimalString,
  height: DecimalString,
  unit: "cm" | "in"
}
```

`width` и `height` — фактически измеренные длины того же образца, которому принадлежат `stitches` и `rows`; номинальный размер образца не используется.

### Формулы

```text
stitchDensity = stitches / width
rowDensity    = rows / height
```

Результат плотности не округляется математическим ядром и возвращается как `ExactValue`; см. раздел 8.

## 4. Контракт расчёта петель и рядов

### Вход `CountsInput`

```text
{
  stitchDensity: DecimalString | RationalInput,
  rowDensity: DecimalString | RationalInput,
  targetWidth: DecimalString,
  targetHeight: DecimalString,
  unit: "cm" | "in",
  construction: "flat" | "round",
  stitchRule: StitchRule,
  rowRule: CountRule
}

RationalInput = { numerator: Integer, denominator: PositiveInteger }

CountRule = {
  rounding: "down" | "up" | "nearest",
  multiple?: PositiveInteger, // default "1"
  offset?: NonNegativeInteger // default "0"
}

StitchRule = CountRule & {
  edgeStitches?: NonNegativeInteger // default "0"
}
```

`stitchDensity` измеряется в петлях на `unit`, `rowDensity` — в рядах на `unit`; `RationalInput` позволяет без потерь передать предыдущий точный результат плотности. Плотность всегда применяется к **полному** числу петель на фактически измеренной ширине образца. Поэтому `edgeStitches` входят в число петель образца, `rawStitches` и `finalStitches`; только тело без кромочных проверяется на раппорт.

До применения правил вычисляются независимые значения:

```text
rawStitches = stitchDensity × targetWidth
rawRows     = rowDensity × targetHeight
```

Ширина и высота не влияют друг на друга: `stitchRule` применяется только к `rawStitches`, `rowRule` — только к `rawRows`. Результат одного измерения никогда не является входом округления другого.

При `construction = "round"` машинные имена и формулы не меняются, но `rows`, `rowDensity`, `targetHeight`, `rawRows` и `finalRows` означают соответственно завершённые круги (раунды), плотность завершённых раундов на единицу высоты, целевую высоту полотна, неокруглённое и итоговое число завершённых раундов.

## 5. Округление

### 5.1. Округление до целого

Для неотрицательного числа `x`:

```text
roundDown(x)    = floor(x)
roundUp(x)      = ceil(x)
roundNearest(x) = floor(x), если frac(x) < 0.5; иначе ceil(x)
```

То есть точная граница `.5` округляется **вверх, к большему целому** (`2.5 → 3`, `0.5 → 1`). Входные количества неотрицательны, поэтому это правило полностью определено; для отрицательных чисел оно не применяется, поскольку они невалидны.

`round(x, rounding)` далее означает `roundDown(x)`, `roundUp(x)` или `roundNearest(x)` согласно коду `rounding`.

При `multiple = 1`, `offset = 0` итог равен соответствующему значению выше.

### 5.2. Округление до ограничения `offset + k × multiple`

Для `multiple = m > 0`, `offset = o`, где `0 ≤ o < m`, множество допустимых количеств:

```text
A(m, o) = { o + k × m | k — целое, k ≥ 0 }
```

Для округляемого неотрицательного `x` результат `constrain(x, m, o, rounding)` определён так:

```text
если 0 ≤ x < o:  o
если x ≥ o:      q = (x - o) / m;
                  o + round(q, rounding) × m
```

При `x < o` нулевой допустимый член `A(m, o)` уже равен `o`, поэтому все три режима возвращают `o`; `q` в этом случае не вычисляется и не бывает отрицательным. При равной удалённости от двух допустимых значений выбирается большее (`m=4, o=0, x=10 → 12`). Ограничение выбирается непосредственно относительно точного `x`, а не после предварительного округления `x` до целого. В результате `unconstrainedRounded` и `final` могут различаться.

### 5.3. Порядок для петель, раппорта и кромочных

`edgeStitches = e` — число кромочных петель в суммарном наборе, а не на каждой стороне. Для плоского полотна это обычно `0`, `1` или `2` и передаётся явно. Тело полотна должно удовлетворять раппорту:

```text
rawBodyStitches   = rawStitches - e
roundedBody       = constrain(rawBodyStitches, stitchRule.multiple, stitchRule.offset, stitchRule.rounding)
finalStitches     = e + roundedBody
unconstrainedRoundedStitches = round(rawStitches, stitchRule.rounding)
```

Следовательно, итоговый набор для плоского вязания имеет форму:

```text
finalStitches = edgeStitches + offset + k × multiple, k ≥ 0
```

Кромочные не считаются частью раппорта. Для рядов `edgeStitches` отсутствует:

```text
finalRows = constrain(rawRows, rowRule.multiple, rowRule.offset, rowRule.rounding)
unconstrainedRoundedRows = round(rawRows, rowRule.rounding)
```

При `construction = "round"` поле `edgeStitches` обязательно равно `0`: круговое вязание не имеет кромочных петель. Вязание по кругу не меняет арифметику ширины: `targetWidth` — длина (обычно окружность) готового полотна, а `finalStitches / stitchDensity` — соответствующая фактическая длина. При `construction = "flat"` ширина — плоская ширина полотна; кромочные включены в неё и в `finalStitches`.

## 6. Фактический размер и отклонение

После получения итогов:

```text
actualWidth  = finalStitches / stitchDensity
actualHeight = finalRows / rowDensity
widthDelta   = actualWidth - targetWidth
heightDelta  = actualHeight - targetHeight
```

Дробные и знаковые математические значения результата (`stitchDensity`, `rowDensity`, `raw`, `actual`, `delta`) сериализуются как `ExactValue`, в том числе если их численное значение случайно целое. Количества петель и рядов (`unconstrainedRounded`, `final`, `edgeStitches`) сериализуются как канонические целочисленные строки соответствующего типа. Форматирование десятичного приближения и локализация находятся за пределами этого контракта.

## 7. Валидация и ошибки

Проверки выполняются до вычисления; при хотя бы одной ошибке успешный результат не возвращается. Ошибки — стабильные нелокализованные коды, без текстовых сообщений.

Для каждого поля возвращается не более одна первичная ошибка. Сначала проверяется формат поля, затем его собственный диапазон; при ошибке формата проверка диапазона этого поля не выполняется. Зависимая проверка выполняется только когда все её предпосылки валидны; например, `invalid_offset` проверяется только при валидном `stitchRule.multiple`, `edge_stitches_in_round` — при валидных `construction` и `stitchRule.edgeStitches`, а `negative_raw_body` и `zero_result_count` — только после успешной проверки всех входных предпосылок и вычисления соответствующей оси.

Порядок ошибок не зависит от порядка ключей входного объекта. Канонический порядок полей:

```text
GaugeInput:
stitches, rows, width, height, unit

CountsInput:
stitchDensity, rowDensity, targetWidth, targetHeight, unit, construction,
stitchRule.rounding, stitchRule.multiple, stitchRule.offset, stitchRule.edgeStitches,
rowRule.rounding, rowRule.multiple, rowRule.offset,
stitches.final, rows.final
```

Ошибки сортируются по этому порядку. В одном поле код выбирается по порядку: формат, затем собственный диапазон, затем зависимое ограничение. Для `stitchRule.edgeStitches` зависимый приоритет фиксирован: сначала `edge_stitches_in_round`, затем `negative_raw_body`; вторая проверка не выполняется, если вернулась первая. `negative_raw_body` всегда имеет поле `"stitchRule.edgeStitches"`. Производные ошибки `zero_result_count` имеют поля `"stitches.final"` и `"rows.final"` соответственно.

| Код | Условие |
| --- | --- |
| `invalid_number` | Поле типа `DecimalString` не соответствует его формату. |
| `invalid_integer` | Поле одного из целочисленных типов не соответствует его формату. |
| `invalid_rational` | `RationalInput` не имеет форму `{ numerator: Integer, denominator: PositiveInteger }`. |
| `non_positive_measurement` | `width`, `height`, `targetWidth` или `targetHeight` меньше либо равны нулю. |
| `non_positive_density` | Любая плотность меньше либо равна нулю. |
| `non_positive_count` | В `GaugeInput` `stitches` или `rows` меньше либо равны нулю. |
| `non_positive_multiple` | `multiple` меньше либо равен нулю. |
| `invalid_offset` | `offset < 0` или `offset ≥ multiple`. |
| `invalid_rounding` | Неизвестный код округления. |
| `invalid_unit` | Неизвестная единица. |
| `invalid_construction` | Неизвестный режим вязания. |
| `edge_stitches_in_round` | Для `construction = "round"` передано `edgeStitches != 0`. |
| `negative_raw_body` | Поле `stitchRule.edgeStitches`: `rawStitches < edgeStitches`; кромочные уже превышают расчётное число петель. |
| `zero_result_count` | После правил итог соответствующей оси равен нулю; поле — `stitches.final` или `rows.final`. |

В `GaugeInput` нулевые или отрицательные `stitches` и `rows` отклоняются как `non_positive_count`; ядро не возвращает нулевую плотность. Для валидного `RationalInput` с неположительным числителем плотности возвращается `non_positive_density` на поле плотности.

## 8. Структурированный результат

Успешные результаты не содержат локализованных строк.

```text
GaugeSuccess = {
  ok: true,
  contractVersion: "1.0.0",
  kind: "gauge",
  unit: "cm" | "in",
  stitchDensity: ExactValue,
  rowDensity: ExactValue
}

CountsSuccess = {
  ok: true,
  contractVersion: "1.0.0",
  kind: "counts",
  unit: "cm" | "in",
  construction: "flat" | "round",
  stitches: AxisResult,
  rows: AxisResult
}

ExactValue = {
  rational: { numerator: Integer, denominator: PositiveInteger }
}

AxisResult = {
  raw: ExactValue,
  unconstrainedRounded: NonNegativeInteger,
  final: PositiveInteger,
  actual: ExactValue,
  delta: ExactValue,
  rule: { rounding, multiple, offset },
  edgeStitches?: NonNegativeInteger // только ось stitches
}

Failure = {
  ok: false,
  contractVersion: "1.0.0",
  kind: "gauge" | "counts",
  errors: Array<{ code: ErrorCode, field: String }>
}
```

`ExactValue.rational` каноничен: дробь сокращена, знаменатель строго положителен, а ноль всегда представлен как `{ numerator: "0", denominator: "1" }`. Десятичное отображение не является частью результата ядра. `field` — машинный путь, например `"targetWidth"` или `"stitchRule.offset"`; порядок `errors` определён в разделе 7.

## 9. Контрольные примеры

1. **Фактическая длина и 10 cm ≠ 4 in.** Для образца `20` петель на `10 cm`: `stitchDensity = 2 stitches/cm`. На ширину `10 cm` получается `rawStitches = 20`. Те же `20` петель на `4 in` дают `5 stitches/in`; на `10 cm = 3.937007874… in` получается `19.685039370…`, а не `20`.
2. **Граница `.5`.** При `stitchDensity = 2.5 stitches/cm`, `targetWidth = 1 cm`, без ограничения: `rawStitches = 2.5`, `unconstrainedRounded = 3`, `final = 3`, `actualWidth = 1.2 cm`.
3. **Раппорт и кромочные в плоском вязании.** `rawStitches = 51`, `edgeStitches = 2`, `multiple = 4`, `offset = 1`, `rounding = "nearest"`: `rawBodyStitches = 49`, допустимое тело `1 + 4k`; `49` допустимо, поэтому `finalStitches = 2 + 49 = 51`. Если `rawStitches = 53`, то `rawBodyStitches = 51`, ближайшие `49` и `53` равноудалены, выбирается `53`; `finalStitches = 55`.
4. **Независимость осей.** При `rawStitches = 30.2`, `rawRows = 40.8`, правилах `down` для петель и `up` для рядов: итог — `30` петель и `41` ряд. Правило одной оси не изменяет другую.
5. **Круговое вязание.** Для `construction = "round"`, `edgeStitches = 1` возвращается `edge_stitches_in_round`; с `edgeStitches = 0` раппорт применяется к полному количеству петель.
6. **Значение ниже смещения.** При `multiple = 4`, `offset = 3` и `rawRows = 2.9` все правила `down`, `up` и `nearest` дают `finalRows = 3`: это первый допустимый раунд, а `q` не вычисляется.

## 10. Версионирование и история

`contractVersion` обязателен в каждом сохранённом результате и снимке входа. Историческая запись воспроизводится только тем расчётчиком, который поддерживает её точную версию контракта; её нельзя молча пересчитывать по новой версии.

Изменения без изменения математического смысла (новая необязательная метаинформация, дополнительные поля отображения) допускаются в `1.x` и не меняют интерпретацию существующих полей. Любое изменение формулы, коэффициента единиц, порядка округления, правила `.5`, значения по умолчанию или смысла кромочных требует нового major-номера и явной миграции истории: исходные входы и прежний результат сохраняются вместе с исходной `contractVersion`.
