$ErrorActionPreference = 'Stop'
$base = 'F:\Cartier'
$source = Get-Content -LiteralPath "$base\audit\xelle-products-source.json" -Raw | ConvertFrom-Json
function PlainText([string]$html) {
  $text = [regex]::Replace($html, '(?i)<br\s*/?>', "`n")
  $text = [regex]::Replace($text, '<[^>]+>', '')
  return ([Net.WebUtility]::HtmlDecode($text) -replace '\r?\n\s*\r?\n', "`n").Trim()
}
function Section([string]$html, [string]$heading) {
  $pattern = '(?s)<h2[^>]*>\s*' + [regex]::Escape($heading) + '\s*</h2>.*?<div class="accordion__content rte"[^>]*>(.*?)</div>'
  $match = [regex]::Match($html, $pattern)
  if (-not $match.Success) { throw "Missing section $heading" }
  return PlainText $match.Groups[1].Value
}
$summaries = @{
  'pornstar-martini-50-ml' = 'Litchi și șampanie, o inimă florală cu trandafir și o bază caldă de santal, ambră și vanilie.'
  'prosecco-di-cherry-50-ml' = 'Cireșe și acorduri efervescente, flori albe și o bază de mosc, vanilie, ambră și patchouli.'
  'spiced-peach-negroni' = 'Piersică și citrice cu accente licoroase, ghimbir și scorțișoară, urmate de o bază ambrată cu patchouli.'
  'maracuja-mojito-50-ml' = 'Bergamotă și fructul pasiunii, o inimă de iasomie și iris, apoi santal, ambră, mosc și vanilie.'
}
$imageDescriptions = @{
  'pornstar-martini-50-ml' = 'Fotografie de campanie: model în negru pe fundal luminos, cu flacon în dreapta jos.'
  'prosecco-di-cherry-50-ml' = 'Fotografie de campanie: portret cu flacon ținut în stânga sus.'
  'spiced-peach-negroni' = 'Fotografie de campanie: flacon între două mâini, pe fundal luminos.'
  'maracuja-mojito-50-ml' = 'Fotografie de campanie: flacon ținut între mâini acoperite cu plasă decorativă neagră.'
}
$positions = @{
  'pornstar-martini-50-ml' = '64% 72%'
  'prosecco-di-cherry-50-ml' = '40% 28%'
  'spiced-peach-negroni' = '55% 54%'
  'maracuja-mojito-50-ml' = '50% 30%'
}
$products = @($source.products | ForEach-Object {
  $product = $_
  $url = 'https://xelle.ro/products/' + $product.handle
  $html = [IO.File]::ReadAllText("$base\audit\xelle-$($product.handle).html")
  $notesText = Section $html 'Note și acorduri'
  $notes = [ordered]@{}
  foreach ($line in ($notesText -split "`n")) {
    $parts = $line.Trim() -split ':\s*',2
    if ($parts.Count -eq 2) { $notes[$parts[0]] = @($parts[1] -split ',\s*') }
  }
  [ordered]@{
    id = $product.id
    name = $product.title -replace ' 50 ml$',''
    title = $product.title
    handle = $product.handle
    url = $url
    price = [decimal]$product.variants[0].price
    currency = 'RON'
    priceFormatted = ([decimal]$product.variants[0].price).ToString('0', [Globalization.CultureInfo]::InvariantCulture) + ' lei'
    volumeMl = 50
    concentration = 'Extrait de Parfum'
    concentrationSource = 'Visible label in original product photo, visually inspected on 2026-09-14.'
    availableAtRetrieval = $product.variants[0].available
    variantId = $product.variants[0].id
    summary = $summaries[$product.handle]
    summaryAttribution = @{ type = 'paraphrase'; sourceUrl = $url; sections = @('Descriere','Note și acorduri') }
    notesPublishedText = $notesText
    notes = $notes
    notesSourceUrl = $url
    notesSourceSection = 'Note și acorduri'
    familyPublishedText = Section $html 'Bine de știut'
    images = @($product.images | ForEach-Object {
      $filename = $product.handle + [IO.Path]::GetExtension(([uri]$_.src).AbsolutePath)
      [ordered]@{
        sourceUrl = $_.src
        localPath = '/xelle/' + $filename
        absolutePath = "$base\public\xelle\$filename"
        width = $_.width
        height = $_.height
        role = 'primary'
        purpose = 'Original product campaign photograph; use for product hero or editorial card.'
        description = $imageDescriptions[$product.handle]
        suggestedObjectPosition = $positions[$product.handle]
        isolatedPackshot = $false
        altered = $false
      }
    })
    secondaryImages = @()
    sourceUrl = $url
    snapshotPath = "$base\audit\xelle-$($product.handle).html"
  }
})
$packshot = [ordered]@{
  sourceUrl = 'https://cdn.shopify.com/s/files/1/0949/9502/2150/files/hf_20260430_190422_cf6d951b-1ad1-4a83-b6c3-acc3ffb462dc.png?v=1782631910'
  sourceProductUrl = 'https://xelle.ro/products/maracuja-mojito'
  localPath = '/xelle/maracuja-mojito-packshot.png'
  absolutePath = "$base\public\xelle\maracuja-mojito-packshot.png"
  width = 4096
  height = 4096
  role = 'secondary'
  purpose = 'Official isolated perfume packshot from Maracuja Mojito Set media. Primary reference for bottle geometry and label.'
  description = 'Flacon Maracuja Mojito izolat pe alb: sticlă cilindrică transparentă, bază groasă, lichid auriu, etichetă albă curbată, capac negru sferic lucios.'
  isolatedPackshot = $true
  transparentBackground = $false
  altered = $false
}
($products | Where-Object { $_.handle -eq 'maracuja-mojito-50-ml' }).secondaryImages = @($packshot)
$assets = Get-Content -LiteralPath "$base\audit\xelle-brand-assets-source.json" -Raw | ConvertFrom-Json
$extraAssets = @(Get-Content -LiteralPath "$base\audit\xelle-extra-assets-source.json" -Raw | ConvertFrom-Json)
$extraAssets += @(Get-Content -LiteralPath "$base\audit\xelle-set-assets-source.json" -Raw | ConvertFrom-Json)
$catalog = [ordered]@{
  brand = 'Xellé'
  siteUrl = 'https://xelle.ro/'
  collectionUrl = 'https://xelle.ro/collections/parfum'
  catalogSourceUrl = 'https://xelle.ro/collections/parfum/products.json?limit=250'
  retrievedAt = [DateTime]::UtcNow.ToString('o')
  currency = 'RON'
  products = $products
  brandAssets = @($assets | ForEach-Object {
    [ordered]@{sourceUrl=$_.url; localPath='/xelle/'+$_.name; absolutePath="$base\public\xelle\$($_.name)"}
  })
  campaignAndSetAssets = @($extraAssets | ForEach-Object {
    [ordered]@{sourceUrl=$_.url; localPath='/xelle/'+$_.name; absolutePath="$base\public\xelle\$($_.name)"; role='secondary'; purpose=if ($_.name -like 'DSC*') {'Official homepage campaign photo'} elseif ($_.name -like 'ChatGPTImage*') {'Official gift set packshot'} else {'Official Maracuja gift set component packshot'} }
  })
  verificationNotes = @(
    'All product data fetched from official Xelle storefront; published olfactory notes parsed from each live product page.',
    'Product descriptions in summary are concise paraphrases. Exact published note lists are separately preserved.',
    'The four individual perfume endpoints and pages expose one original campaign image each and no 3D model media. An isolated Maracuja perfume packshot was found separately in Maracuja Mojito Set media.',
    'Product availability is read from the public Shopify JSON, not hidden theme Sold out labels.',
    'Prices and availability are snapshots; live checkout should occur on xelle.ro.'
  )
}
$json = $catalog | ConvertTo-Json -Depth 20
[IO.File]::WriteAllText("$base\audit\xelle-catalog.json", $json, [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText("$base\public\xelle\catalog.json", $json, [Text.UTF8Encoding]::new($false))
$products | ForEach-Object { [pscustomobject]$_ } | Select-Object name,price,volumeMl,@{N='Notes';E={$_.notesPublishedText -replace "`n",' | '}} | Format-List
