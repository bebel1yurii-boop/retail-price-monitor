import { AtbParser } from './atbParser';
import { AuchanParser } from './auchanParser';
import { GenericParser } from './genericParser';
import { MetroParser } from './metroParser';
import { NovusParser } from './novusParser';
import { ForaParser } from './foraParser';
import { SilpoParser } from './silpoParser';
import { findProductionAdapter } from './adapterConfigs';
import { SearchHtmlParser } from './searchHtmlParser';
import { PlaywrightSearchParser } from './playwrightSearchParser';
import { ZakazApiParser } from './zakazApiParser';
import { getZakazChainForNetwork } from './zakazChains';
import { WoocommerceStoreParser } from './woocommerceStoreParser';
import { ThrashGraphqlParser } from './thrashGraphqlParser';
import { ForaCatalogParser } from './foraCatalogParser';
import { VarusSearchParser } from './varusSearchParser';
import { FozzyPlaywrightParser } from './fozzyPlaywrightParser';
import type { BaseParser } from './baseParser';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest } from '../types';

export function createParser(request: ParseRequest, logger: LoggerService): BaseParser {
  if (process.env.DEMO_MODE !== 'true') {
    const zakazChain = getZakazChainForNetwork(request.network);
    if (zakazChain) {
      return new ZakazApiParser(request, logger, zakazChain);
    }
    if (request.network.toUpperCase().includes('ВЕЛИКА КИШЕНЯ')) {
      return new WoocommerceStoreParser(request, logger, 'https://kishenya.ua');
    }
    if (request.network.toUpperCase().includes('ТРАШ')) {
      return new ThrashGraphqlParser(request, logger);
    }
    if (request.network.toUpperCase().includes('ФОРА')) {
      return new ForaCatalogParser(request, logger);
    }
    if (request.network.toUpperCase().includes('ВАРУС')) {
      return new VarusSearchParser(request, logger);
    }
    if (request.network.toUpperCase().includes('ФОЗЗІ')) {
      return new FozzyPlaywrightParser(request, logger);
    }
    const config = findProductionAdapter(request.network);
    if (config?.parserType === 'html' || config?.parserType === 'api') {
      return new SearchHtmlParser(request, logger, config);
    }
    if (config?.parserType === 'playwright') {
      return new PlaywrightSearchParser(request, logger, config);
    }
    return new GenericParser(request, logger);
  }

  const network = request.network.toUpperCase();
  if (network.includes('АТБ')) return new AtbParser(request, logger);
  if (network.includes('МЕТРО')) return new MetroParser(request, logger);
  if (network.includes('АШАН')) return new AuchanParser(request, logger);
  if (network.includes('СІЛЬПО') || network.includes('ФОЗЗІ')) return new SilpoParser(request, logger);
  if (network.includes('НОВУС')) return new NovusParser(request, logger);
  if (network.includes('ФОРА')) return new ForaParser(request, logger);
  return new GenericParser(request, logger);
}
